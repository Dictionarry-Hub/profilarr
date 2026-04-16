<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { Plus } from 'lucide-svelte';
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import FilterModeToggle from '$ui/actions/FilterModeToggle.svelte';
	import SmartFilterBar from '$ui/filter/SmartFilterBar.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import CloneModal from '$ui/modal/CloneModal.svelte';
	import TableView from './views/TableView.svelte';
	import CardView from './views/CardView.svelte';
	import { getPersistentSearchStore } from '$stores/search';
	import { filterMode } from '$stores/filterMode';
	import type { FilterFieldDef, FilterTag } from '$ui/filter/types';
	import { applySmartFilters } from '$ui/filter/match';
	import type { ViewMode } from '$lib/client/stores/dataPage';
	import { alertStore } from '$alerts/store';
	import type { QualityProfileTableRow } from '$shared/pcd/display';
	import type { PageData } from './$types';

	export let data: PageData;

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
				entityType: 'quality_profile',
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

	const fields: FilterFieldDef<QualityProfileTableRow>[] = [
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
			key: 'language',
			label: 'Language',
			type: 'text',
			accessor: (item) => item.language?.name ?? null,
			suggestions: (items) =>
				[...new Set(items.map((i) => i.language?.name).filter(Boolean) as string[])].sort()
		},
		{
			key: 'upgrades',
			label: 'Upgrades',
			type: 'text',
			accessor: (item) => (item.upgrades_allowed ? 'yes' : 'no'),
			suggestions: () => ['yes', 'no']
		},
		{
			key: 'formats',
			label: 'Formats',
			type: 'number',
			accessor: (item) => item.custom_formats.total
		}
	];

	// Simple search fallback (used on mobile and when filterMode is 'simple')
	$: simpleSearchStore = getPersistentSearchStore(`qpSearch:${data.currentDatabase.id}`, {
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

	const VIEW_STORAGE_KEY = 'qualityProfilesView';

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
			if (!simpleQuery) return data.qualityProfiles;
			const q = simpleQuery.toLowerCase();
			return data.qualityProfiles.filter((p) => p.name.toLowerCase().includes(q));
		}
		return applySmartFilters(data.qualityProfiles, filterTags, fields);
	})();

	// Map databases to tabs
	$: tabs = data.databases.map((db) => ({
		label: db.name,
		href: `/quality-profiles/${db.id}`,
		active: db.id === data.currentDatabase.id
	}));
</script>

<svelte:head>
	<title>Quality Profiles - {data.currentDatabase?.name} - Profilarr</title>
</svelte:head>

<div class="space-y-6 px-4 pt-4 pb-8 md:px-8">
	<!-- Tabs -->
	<Tabs {tabs} responsive />

	<!-- Actions Bar -->
	<ActionsBar>
		{#if useSimpleMode}
			<SearchAction
				searchStore={simpleSearchStore}
				placeholder="Search quality profiles..."
				responsive
			/>
		{:else}
			<SmartFilterBar
				{fields}
				items={data.qualityProfiles}
				bind:tags={filterTags}
				storageKey={`smartFilter:qualityProfiles:${data.currentDatabase.id}`}
				placeholder="Filter quality profiles..."
			/>
		{/if}
		<Tooltip text="New">
			<ActionButton
				icon={Plus}
				on:click={() => goto(`/quality-profiles/${data.currentDatabase.id}/new`)}
			/>
		</Tooltip>
		{#if !isMobile}
			<FilterModeToggle bind:value={$filterMode} />
		{/if}
		<ViewToggle bind:value={viewMode} />
	</ActionsBar>

	<!-- Quality Profiles Content -->
	<div class="mt-6">
		{#if data.qualityProfiles.length === 0}
			<div
				class="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900"
			>
				<p class="text-neutral-600 dark:text-neutral-400">
					No quality profiles found for {data.currentDatabase?.name}
				</p>
			</div>
		{:else if filtered.length === 0}
			<div
				class="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900"
			>
				<p class="text-neutral-600 dark:text-neutral-400">
					No quality profiles match the current filters
				</p>
			</div>
		{:else if viewMode === 'table'}
			<TableView
				profiles={filtered}
				databaseId={data.currentDatabase.id}
				on:clone={handleClone}
				on:export={handleExport}
			/>
		{:else}
			<CardView
				profiles={filtered}
				databaseId={data.currentDatabase.id}
				on:clone={handleClone}
				on:export={handleExport}
			/>
		{/if}
	</div>
</div>

<CloneModal
	bind:open={cloneModalOpen}
	databaseId={data.currentDatabase.id}
	entityType="quality_profile"
	sourceName={cloneSourceName}
	existingNames={data.qualityProfiles.map((p) => p.name)}
	canWriteToBase={data.canWriteToBase}
/>
