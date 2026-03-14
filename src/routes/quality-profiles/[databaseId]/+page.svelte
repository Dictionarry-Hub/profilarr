<script lang="ts">
	import { goto } from '$app/navigation';
	import { Plus, Type, Tag, AlignLeft } from 'lucide-svelte';
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import SearchModeToggle from '$ui/actions/SearchModeToggle.svelte';
	import TagInput from '$ui/form/TagInput.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import CloneModal from '$ui/modal/CloneModal.svelte';
	import TableView from './views/TableView.svelte';
	import CardView from './views/CardView.svelte';
	import { createDataPageStore } from '$lib/client/stores/dataPage';
	import { filterByText, filterByTags, createSearchFieldState } from '$lib/client/utils/search';
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

	// Search field options
	const searchFields = [
		{ value: 'name', label: 'Name' },
		{ value: 'tags', label: 'Tags' },
		{ value: 'description', label: 'Description' }
	];

	const searchFieldIcons: Record<string, typeof Type> = {
		name: Type,
		tags: Tag,
		description: AlignLeft
	};

	const searchState = createSearchFieldState('qualityProfilesSearch', searchFields);

	let activeSearchField = searchState.initialField;
	let searchTags: string[] = searchState.initialTags;

	$: isTagMode = activeSearchField === 'tags';
	$: searchFieldIcon = searchFieldIcons[activeSearchField] || Type;

	function handleFieldChange(field: string) {
		if (field === activeSearchField) return;
		if (field === 'tags') {
			search.clear();
		} else {
			searchTags = [];
			searchState.clearTags();
		}
		activeSearchField = field;
		searchState.saveField(field);
	}

	function handleTagsChange(tags: string[]) {
		searchTags = tags;
		searchState.saveTags(tags);
	}

	// Field accessors for text search
	const fieldAccessors: Record<string, (item: QualityProfileTableRow) => string | string[] | null> =
		{
			name: (item) => item.name,
			tags: (item) => item.tags.map((t) => t.name),
			description: (item) => item.description ?? null
		};

	// Initialize data page store (we use search and view, but do our own filtering)
	const { search, view, setItems } = createDataPageStore(data.qualityProfiles, {
		storageKey: 'qualityProfilesView',
		searchKeys: ['name'], // Placeholder, we do our own filtering
		searchKey: `qualityProfilesSearch:${data.currentDatabase.id}`
	});

	const debouncedQuery = search.debouncedQuery;

	// Update items when data changes (e.g., switching databases)
	$: setItems(data.qualityProfiles);

	// Filtering based on active search field
	$: filtered = (() => {
		if (isTagMode) {
			return filterByTags(data.qualityProfiles, searchTags, (item) => item.tags.map((t) => t.name));
		}
		return filterByText(data.qualityProfiles, $debouncedQuery, fieldAccessors, [activeSearchField]);
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
		<SearchModeToggle
			options={searchFields}
			value={activeSearchField}
			icon={searchFieldIcon}
			onchange={handleFieldChange}
		/>
		{#if isTagMode}
			<div class="flex-1">
				<TagInput
					tags={searchTags}
					placeholder="Type a tag name and press Enter... (prefix NOT: to exclude)"
					onchange={handleTagsChange}
				/>
			</div>
		{:else}
			<SearchAction
				searchStore={search}
				placeholder="Search {searchFields
					.find((f) => f.value === activeSearchField)
					?.label.toLowerCase() ?? ''}..."
				responsive
			/>
		{/if}
		<ActionButton
			icon={Plus}
			on:click={() => goto(`/quality-profiles/${data.currentDatabase.id}/new`)}
		/>
		<ViewToggle bind:value={$view} />
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
				<p class="text-neutral-600 dark:text-neutral-400">No quality profiles match your search</p>
			</div>
		{:else if $view === 'table'}
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
