<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import SmartFilterBar from '$ui/filter/SmartFilterBar.svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import CloneModal from '$ui/modal/CloneModal.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import TableView from './views/TableView.svelte';
	import CardView from './views/CardView.svelte';
	import { getPersistentSearchStore } from '$stores/search';
	import type { FilterFieldDef, FilterTag } from '$ui/filter/types';
	import { applySmartFilters } from '$ui/filter/match';
	import type { ViewMode } from '$lib/client/stores/dataPage';
	import { Info, Plus, FileText, Users } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { alertStore } from '$alerts/store';
	import type { RegularExpressionWithTags } from '$shared/pcd/display';
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
				entityType: 'regular_expression',
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

	const fields: FilterFieldDef<RegularExpressionWithTags>[] = [
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
			key: 'pattern',
			label: 'Pattern',
			type: 'text',
			accessor: (item) => item.pattern
		},
		{
			key: 'description',
			label: 'Description',
			type: 'text',
			accessor: (item) => item.description ?? null
		},
		{
			key: 'regex101_id',
			label: 'Regex101 ID',
			type: 'text',
			accessor: (item) => item.regex101_id ?? null
		}
	];

	// Mobile simple search fallback
	$: mobileSearchStore = getPersistentSearchStore(`reSearch:${data.currentDatabase.id}`, {
		debounceMs: 150
	});
	$: mobileQuery = $mobileSearchStore.query;

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

	// ======================================================================
	// View Mode
	// ======================================================================

	const VIEW_STORAGE_KEY = 'regularExpressionsView';

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
		let result = applySmartFilters(data.regularExpressions, filterTags, fields);
		if (isMobile && mobileQuery) {
			const q = mobileQuery.toLowerCase();
			result = result.filter((r) => r.name.toLowerCase().includes(q));
		}
		return result;
	})();

	// Map databases to tabs
	$: tabs = data.databases.map((db) => ({
		label: db.name,
		href: `/regular-expressions/${db.id}`,
		active: db.id === data.currentDatabase.id
	}));
</script>

<svelte:head>
	<title>Regular Expressions - {data.currentDatabase?.name} - Profilarr</title>
</svelte:head>

<div class="space-y-6 px-4 pt-4 pb-8 md:px-8">
	<!-- Tabs -->
	<Tabs {tabs} responsive />

	<!-- Actions Bar -->
	<ActionsBar>
		{#if isMobile}
			<SearchAction
				searchStore={mobileSearchStore}
				placeholder="Search regular expressions..."
				responsive
			/>
		{:else}
			<SmartFilterBar
				{fields}
				items={data.regularExpressions}
				bind:tags={filterTags}
				storageKey={`smartFilter:regularExpressions:${data.currentDatabase.id}`}
				placeholder="Filter regular expressions..."
			/>
		{/if}
		<ActionButton icon={Plus} hasDropdown={true} dropdownPosition="right">
			<svelte:fragment slot="dropdown">
				<Dropdown position="right" minWidth="14rem">
					<DropdownHeader label="New expression" />
					<DropdownItem
						icon={FileText}
						label="Blank"
						on:click={() => goto(`/regular-expressions/${data.currentDatabase.id}/new`)}
					/>
					<DropdownItem
						icon={Users}
						label="Release Group"
						on:click={() =>
							goto(`/regular-expressions/${data.currentDatabase.id}/new?preset=release-group`)}
					/>
				</Dropdown>
			</svelte:fragment>
		</ActionButton>
		<ViewToggle bind:value={viewMode} />
		<ActionButton icon={Info} on:click={() => (infoModalOpen = true)} />
	</ActionsBar>

	<!-- Regular Expressions Content -->
	<div class="mt-6">
		{#if data.regularExpressions.length === 0}
			<div
				class="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900"
			>
				<p class="text-neutral-600 dark:text-neutral-400">
					No regular expressions found for {data.currentDatabase?.name}
				</p>
			</div>
		{:else if filtered.length === 0}
			<div
				class="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900"
			>
				<p class="text-neutral-600 dark:text-neutral-400">
					No regular expressions match the current filters
				</p>
			</div>
		{:else if viewMode === 'table'}
			<TableView expressions={filtered} on:clone={handleClone} on:export={handleExport} />
		{:else}
			<CardView expressions={filtered} on:clone={handleClone} on:export={handleExport} />
		{/if}
	</div>
</div>

<!-- Info Modal -->
<InfoModal bind:open={infoModalOpen} header="About Regular Expressions">
	<div class="space-y-4 text-sm text-neutral-700 dark:text-neutral-300">
		<section>
			<h3 class="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">How It Works</h3>
			<p>
				Regular expressions in Profilarr are separated from custom formats to make them reusable.
				When multiple custom formats share the same pattern, you only need to update it in one
				place.
			</p>
			<p class="mt-2">
				When custom formats are synced to your Arr instances, Profilarr compiles the referenced
				patterns into the format each Arr expects. The regular expressions themselves are
				<strong>not</strong> synced directly—only the compiled custom formats are.
			</p>
		</section>

		<section>
			<h3 class="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Regex Flavor</h3>
			<p>
				Radarr and Sonarr use the <strong>.NET regex engine</strong> (specifically .NET 6+). Patterns
				are matched case-insensitively by default.
			</p>
		</section>

		<section>
			<h3 class="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Testing Patterns</h3>
			<p>
				Use <a
					href="https://regex101.com"
					target="_blank"
					rel="noopener noreferrer"
					class="text-accent-600 hover:underline dark:text-accent-400">regex101.com</a
				>
				to test your patterns. Make sure to select the <strong>.NET</strong> flavor from the dropdown
				for accurate results.
			</p>
			<p class="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
				Tip: When saving a regex101 link, include the version number (e.g., <code
					class="rounded bg-neutral-100 px-1 dark:bg-neutral-800">ABC123/1</code
				>) to ensure it always points to your specific version.
			</p>
		</section>
	</div>
</InfoModal>

<CloneModal
	bind:open={cloneModalOpen}
	databaseId={data.currentDatabase.id}
	entityType="regular_expression"
	sourceName={cloneSourceName}
	existingNames={data.regularExpressions.map((r) => r.name)}
	canWriteToBase={data.canWriteToBase}
/>
