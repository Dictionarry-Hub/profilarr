<script lang="ts">
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import SearchModeToggle from '$ui/actions/SearchModeToggle.svelte';
	import TagInput from '$ui/form/TagInput.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import CloneModal from '$ui/modal/CloneModal.svelte';
	import TableView from './views/TableView.svelte';
	import CardView from './views/CardView.svelte';
	import { createDataPageStore } from '$lib/client/stores/dataPage';
	import { filterByText, filterByTags, createSearchFieldState } from '$lib/client/utils/search';
	import { Info, Plus, Type, Tag, AlignLeft, ListChecks } from 'lucide-svelte';
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

	// Search field options
	const searchFields = [
		{ value: 'name', label: 'Name' },
		{ value: 'tags', label: 'Tags' },
		{ value: 'description', label: 'Description' },
		{ value: 'conditions', label: 'Conditions' }
	];

	const searchFieldIcons: Record<string, typeof Type> = {
		name: Type,
		tags: Tag,
		description: AlignLeft,
		conditions: ListChecks
	};

	const searchState = createSearchFieldState('customFormatsSearch', searchFields);

	let activeSearchField = searchState.initialField;
	let searchTags: string[] = searchState.initialTags;

	$: isTagMode = activeSearchField === 'tags' || activeSearchField === 'conditions';
	$: searchFieldIcon = searchFieldIcons[activeSearchField] || Type;

	function handleFieldChange(field: string) {
		if (field === activeSearchField) return;
		const wasTagMode = activeSearchField === 'tags' || activeSearchField === 'conditions';
		const willBeTagMode = field === 'tags' || field === 'conditions';
		if (willBeTagMode && !wasTagMode) {
			search.clear();
		} else if (!willBeTagMode && wasTagMode) {
			searchTags = [];
			searchState.clearTags();
		} else if (willBeTagMode && wasTagMode) {
			// Switching between tag modes — clear tags
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
	const fieldAccessors: Record<string, (item: CustomFormatTableRow) => string | string[] | null> = {
		name: (item) => item.name,
		tags: (item) => item.tags.map((t) => t.name),
		description: (item) => item.description ?? null,
		conditions: (item) => item.conditions.map((c) => c.name)
	};

	// Initialize data page store (we use search and view, but do our own filtering)
	const { search, view, setItems } = createDataPageStore(data.customFormats, {
		storageKey: 'customFormatsView',
		searchKeys: ['name'], // Placeholder, we do our own filtering
		searchKey: `customFormatsSearch:${data.currentDatabase.id}`
	});

	const debouncedQuery = search.debouncedQuery;

	// Update items when data changes (e.g., switching databases)
	$: setItems(data.customFormats);

	// Filtering based on active search field
	$: filtered = (() => {
		if (isTagMode) {
			const getItemTags =
				activeSearchField === 'conditions'
					? (item: CustomFormatTableRow) => item.conditions.map((c) => c.name)
					: (item: CustomFormatTableRow) => item.tags.map((t) => t.name);
			return filterByTags(data.customFormats, searchTags, getItemTags);
		}
		return filterByText(data.customFormats, $debouncedQuery, fieldAccessors, [activeSearchField]);
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
					placeholder="Type a {activeSearchField === 'conditions'
						? 'condition'
						: 'tag'} name and press Enter... (prefix NOT: to exclude)"
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
			on:click={() => goto(`/custom-formats/${data.currentDatabase.id}/new`)}
		/>
		<ViewToggle bind:value={$view} />
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
				<p class="text-neutral-600 dark:text-neutral-400">No custom formats match your search</p>
			</div>
		{:else if $view === 'table'}
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
