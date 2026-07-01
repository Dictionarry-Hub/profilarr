<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import FilterModeToggle from '$ui/actions/FilterModeToggle.svelte';
	import SmartFilterBar from '$ui/filter/SmartFilterBar.svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import CloneModal from '$ui/modal/CloneModal.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import TableView from './views/TableView.svelte';
	import CardView from './views/CardView.svelte';
	import { getPersistentSearchStore } from '$stores/search';
	import { filterMode } from '$stores/filterMode';
	import type { FilterFieldDef, FilterTag } from '$ui/filter/types';
	import { applySmartFilters } from '$ui/filter/match';
	import { createViewModeStore } from '$lib/client/stores/dataPage';
	import { Info, Plus, FileText, Users } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { alertStore } from '$alerts/store';
	import type { RegularExpressionWithTags } from '$shared/pcd/display';
	import { copyToClipboard } from '$lib/client/utils/clipboard';
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
				entityType: 'regular_expression',
				name
			});
			const res = await fetch(`/databases/${data.currentDatabase.id}/export?${params}`);
			const json = await res.json();
			if (!res.ok) {
				alertStore.add('error', json.error || 'Export failed');
				return;
			}
			const copied = await copyToClipboard(JSON.stringify(json, null, 2));
			if (!copied) {
				alertStore.add('error', 'Failed to copy to clipboard');
				return;
			}
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
			key: 'referenced',
			label: 'Referenced',
			type: 'text',
			accessor: (item) => (item.referenceCount > 0 ? 'yes' : 'no'),
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

	// Simple search fallback (used on mobile and when filterMode is 'simple')
	$: simpleSearchStore = getPersistentSearchStore(`reSearch:${data.currentDatabase.id}`, {
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

	const viewMode = createViewModeStore({ storageKey: 'regularExpressionsView' });

	// ======================================================================
	// Filtering
	// ======================================================================

	$: filtered = (() => {
		if (useSimpleMode) {
			if (!simpleQuery) return data.regularExpressions;
			const q = simpleQuery.toLowerCase();
			return data.regularExpressions.filter((r) => r.name.toLowerCase().includes(q));
		}
		return applySmartFilters(data.regularExpressions, filterTags, fields);
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

<div class="space-y-6 px-4 pb-8 md:px-8">
	<!-- Tabs -->
	<Tabs {tabs} responsive />

	<!-- Actions Bar -->
	<ActionsBar>
		{#if useSimpleMode}
			<SearchAction
				searchStore={simpleSearchStore}
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
		{#if !isMobile}
			<FilterModeToggle bind:value={$filterMode} />
		{/if}
		<ViewToggle bind:value={$viewMode} />
		<ActionButton icon={Info} on:click={() => (infoModalOpen = true)} />
	</ActionsBar>

	<!-- Regular Expressions Content -->
	<div class="mt-6">
		{#if data.regularExpressions.length === 0}
			<div class="rounded-card border border-border bg-surface p-8 text-center">
				<p class="text-text-soft">
					No regular expressions found for {data.currentDatabase?.name}
				</p>
			</div>
		{:else if filtered.length === 0}
			<div class="rounded-card border border-border bg-surface p-8 text-center">
				<p class="text-text-soft">No regular expressions match the current filters</p>
			</div>
		{:else if $viewMode === 'table'}
			<TableView expressions={filtered} on:clone={handleClone} on:export={handleExport} />
		{:else}
			<CardView expressions={filtered} on:clone={handleClone} on:export={handleExport} />
		{/if}
	</div>
</div>

<!-- Info Modal -->
<InfoModal bind:open={infoModalOpen} header="About Regular Expressions">
	<div class="space-y-4 text-sm text-text-soft">
		<section>
			<h3 class="mb-2 font-semibold text-text">How It Works</h3>
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
			<h3 class="mb-2 font-semibold text-text">Regex Flavor</h3>
			<p>
				Radarr and Sonarr use the <strong>.NET regex engine</strong> (specifically .NET 6+). Patterns
				are matched case-insensitively by default.
			</p>
		</section>

		<section>
			<h3 class="mb-2 font-semibold text-text">Testing Patterns</h3>
			<p>
				Use <a
					href="https://regex101.com"
					target="_blank"
					rel="noopener noreferrer"
					class="text-link-text hover:underline">regex101.com</a
				>
				to test your patterns. Make sure to select the <strong>.NET</strong> flavor from the dropdown
				for accurate results.
			</p>
			<p class="mt-2 text-xs text-text-muted">
				Tip: When saving a regex101 link, include the version number (e.g., <code
					class="rounded-control-sm bg-surface-hover px-1">ABC123/1</code
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
