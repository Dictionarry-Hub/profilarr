<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import FilterModeToggle from '$ui/actions/FilterModeToggle.svelte';
	import SmartFilterBar from '$ui/filter/SmartFilterBar.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import CloneModal from '$ui/modal/CloneModal.svelte';
	import TableView from './views/TableView.svelte';
	import CardView from './views/CardView.svelte';
	import { getPersistentSearchStore } from '$stores/search';
	import { filterMode } from '$stores/filterMode';
	import type { FilterFieldDef, FilterTag } from '$ui/filter/types';
	import { applySmartFilters } from '$ui/filter/match';
	import type { ViewMode } from '$lib/client/stores/dataPage';
	import { Info, Plus } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { alertStore } from '$alerts/store';
	import type { CustomFormatTableRow } from '$shared/pcd/display.ts';
	import type { PageData } from './$types';

	export let data: PageData;

	let infoModalOpen = false;
	let cloneModalOpen = false;
	let cloneSourceName = '';

	function handleClone(event: CustomEvent<{ name: string }>) {
		cloneSourceName = event.detail.name;
		cloneModalOpen = true;
	}

	async function handleExport(event: CustomEvent<{ name: string }>) {
		const { name } = event.detail;
		try {
			const params = new URLSearchParams({
				databaseId: String(data.currentDatabase.id),
				entityType: 'custom_format',
				name
			});
			const res = await fetch(`/api/v1/pcd/export?${params}`);
			const json = await res.json();
			if (!res.ok) {
				alertStore.add('error', json.error || 'Export failed');
				return;
			}
			await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
			alertStore.add('success', `Copied "${name}" to clipboard`);
		} catch {
			alertStore.add('error', 'Export failed');
		}
	}

	// ======================================================================
	// Smart Filter
	// ======================================================================

	let filterTags: FilterTag[] = [];

	const fields: FilterFieldDef<CustomFormatTableRow>[] = [
		{
			key: 'name',
			label: 'Name',
			type: 'text',
			isDefault: true,
			accessor: (item) => item.name,
			suggestions: (items) => items.map((i) => i.name).sort()
		},
		{
			key: 'tag',
			label: 'Tag',
			type: 'text',
			accessor: (item) => item.tags.map((t) => t.name),
			suggestions: (items) => [...new Set(items.flatMap((i) => i.tags.map((t) => t.name)))].sort()
		},
		{
			key: 'tagged',
			label: 'Tagged',
			type: 'text',
			accessor: (item) => (item.tags.length > 0 ? 'yes' : 'no'),
			suggestions: () => ['yes', 'no']
		},
		{
			key: 'description',
			label: 'Description',
			type: 'text',
			accessor: (item) => item.description ?? null
		},
		{
			key: 'condition',
			label: 'Condition',
			type: 'text',
			accessor: (item) => item.conditions.map((c) => c.name),
			suggestions: (items) =>
				[...new Set(items.flatMap((i) => i.conditions.map((c) => c.name)))].sort()
		},
		{
			key: 'tests',
			label: 'Tests',
			type: 'number',
			accessor: (item) => item.testCount
		}
	];

	// Simple search fallback (used on mobile and when filterMode is 'simple')
	$: simpleSearchStore = getPersistentSearchStore(`cfSearch:${data.currentDatabase.id}`, {
		debounceMs: 150
	});
	$: simpleQuery = $simpleSearchStore.query;

	let isMobile = false;
	let mediaQuery: MediaQueryList | null = null;

	onMount(() => {
		if (typeof window !== 'undefined') {
			mediaQuery = window.matchMedia('(max-width: 767px)');
			isMobile = mediaQuery.matches;
			mediaQuery.addEventListener('change', handleMediaChange);
		}
	});

	onDestroy(() => {
		if (mediaQuery) {
			mediaQuery.removeEventListener('change', handleMediaChange);
		}
	});

	function handleMediaChange(e: MediaQueryListEvent) {
		isMobile = e.matches;
	}

	$: useSimpleMode = isMobile || $filterMode === 'simple';

	// ======================================================================
	// View Mode
	// ======================================================================

	const VIEW_STORAGE_KEY = 'customFormatsView';

	function loadViewMode(): ViewMode {
		if (!browser) return 'table';
		try {
			const stored = localStorage.getItem(VIEW_STORAGE_KEY);
			if (stored === 'cards' || stored === 'table') return stored;
		} catch {}
		return window.innerWidth < 768 ? 'cards' : 'table';
	}

	let viewMode: ViewMode = loadViewMode();

	$: if (browser) {
		localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
	}

	// ======================================================================
	// Filtering
	// ======================================================================

	$: filtered = (() => {
		if (useSimpleMode) {
			if (!simpleQuery) return data.customFormats;
			const q = simpleQuery.toLowerCase();
			return data.customFormats.filter((f) => f.name.toLowerCase().includes(q));
		}
		return applySmartFilters(data.customFormats, filterTags, fields);
	})();

	// Map databases to tabs
	$: tabs = data.databases.map((db) => ({
		label: db.name,
		href: `/custom-formats/${db.id}`,
		active: db.id === data.currentDatabase.id
	}));
</script>

<svelte:head>
	<title>Custom Formats - {data.currentDatabase?.name} - Profilarr</title>
</svelte:head>

<div class="space-y-6 px-4 pt-4 pb-8 md:px-8">
	<!-- Tabs -->
	<Tabs {tabs} responsive />

	<!-- Actions Bar -->
	<ActionsBar>
		{#if useSimpleMode}
			<SearchAction
				searchStore={simpleSearchStore}
				placeholder="Search custom formats..."
				responsive
			/>
		{:else}
			<SmartFilterBar
				{fields}
				items={data.customFormats}
				bind:tags={filterTags}
				storageKey={`smartFilter:customFormats:${data.currentDatabase.id}`}
				placeholder="Filter custom formats..."
			/>
		{/if}
		<Tooltip text="New">
			<ActionButton
				icon={Plus}
				on:click={() => goto(`/custom-formats/${data.currentDatabase.id}/new`)}
			/>
		</Tooltip>
		{#if !isMobile}
			<FilterModeToggle bind:value={$filterMode} />
		{/if}
		<ViewToggle bind:value={viewMode} />
		<ActionButton icon={Info} on:click={() => (infoModalOpen = true)} />
	</ActionsBar>

	<!-- Custom Formats Content -->
	<div class="mt-6">
		{#if data.customFormats.length === 0}
			<div
				class="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900"
			>
				<p class="text-neutral-600 dark:text-neutral-400">
					No custom formats found for {data.currentDatabase?.name}
				</p>
			</div>
		{:else if filtered.length === 0}
			<div
				class="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900"
			>
				<p class="text-neutral-600 dark:text-neutral-400">
					No custom formats match the current filters
				</p>
			</div>
		{:else if viewMode === 'table'}
			<TableView formats={filtered} on:clone={handleClone} on:export={handleExport} />
		{:else}
			<CardView formats={filtered} on:clone={handleClone} on:export={handleExport} />
		{/if}
	</div>
</div>

<!-- Info Modal -->
<InfoModal bind:open={infoModalOpen} header="About Custom Formats">
	<div class="space-y-4 text-sm text-neutral-700 dark:text-neutral-300">
		<section>
			<h3 class="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">
				What Are Custom Formats?
			</h3>
			<p>
				Custom formats identify specific release characteristics &mdash; codec, resolution, source,
				release group, and more. When a release matches a format's conditions, quality profiles use
				its score to decide which releases are preferred.
			</p>
		</section>

		<section>
			<h3 class="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Conditions</h3>
			<p>
				Each custom format has one or more conditions grouped by type (Release Title, Release Group,
				Source, Resolution, etc.). Conditions use AND logic between types and OR logic within a
				type, with <strong>Required</strong> and <strong>Negate</strong> modifiers to change this behavior.
				Each condition type is explained in detail on the conditions tab when editing a format.
			</p>
		</section>

		<section>
			<h3 class="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">
				Regular Expressions in Profilarr
			</h3>
			<p>
				Release Title conditions use regular expressions (regex) to match patterns in release names.
				In Profilarr, regex patterns are managed as their own reusable entity &mdash; a single
				pattern can be shared across multiple custom formats. When a pattern is updated, every
				format using it gets the change automatically.
			</p>
			<p class="mt-2">
				You can browse and manage patterns on the
				<a
					href="/regular-expressions/{data.currentDatabase.id}"
					class="font-medium text-accent-600 underline hover:text-accent-500 dark:text-accent-400 dark:hover:text-accent-300"
				>
					Regular Expressions
				</a> page.
			</p>
		</section>
	</div>
</InfoModal>

<CloneModal
	bind:open={cloneModalOpen}
	databaseId={data.currentDatabase.id}
	entityType="custom_format"
	sourceName={cloneSourceName}
	existingNames={data.customFormats.map((f) => f.name)}
	canWriteToBase={data.canWriteToBase}
/>
