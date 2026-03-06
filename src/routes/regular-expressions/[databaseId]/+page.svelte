<script lang="ts">
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import CloneModal from '$ui/modal/CloneModal.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import TableView from './views/TableView.svelte';
	import CardView from './views/CardView.svelte';
	import SearchModeToggle from '$ui/actions/SearchModeToggle.svelte';
	import TagInput from '$ui/form/TagInput.svelte';
	import { createDataPageStore } from '$lib/client/stores/dataPage';
	import { filterByText, filterByTags, createSearchFieldState } from '$lib/client/utils/search';
	import { Info, Plus, FileText, Users, Type, Tag, Code, AlignLeft, Link } from 'lucide-svelte';
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

	// Search field options
	const searchFields = [
		{ value: 'name', label: 'Name' },
		{ value: 'tags', label: 'Tags' },
		{ value: 'pattern', label: 'Pattern' },
		{ value: 'description', label: 'Description' },
		{ value: 'regex101_id', label: 'Regex101 ID' }
	];

	const searchFieldIcons: Record<string, typeof Type> = {
		name: Type,
		tags: Tag,
		pattern: Code,
		description: AlignLeft,
		regex101_id: Link
	};

	const searchState = createSearchFieldState('regularExpressionsSearch', searchFields);

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
	const fieldAccessors: Record<
		string,
		(item: RegularExpressionWithTags) => string | string[] | null
	> = {
		name: (item) => item.name,
		tags: (item) => item.tags.map((t) => t.name),
		pattern: (item) => item.pattern,
		description: (item) => item.description ?? null,
		regex101_id: (item) => item.regex101_id ?? null
	};

	// Initialize data page store (we'll use search and view, but do our own filtering)
	const { search, view, setItems } = createDataPageStore(data.regularExpressions, {
		storageKey: 'regularExpressionsView',
		searchKeys: ['name'], // Placeholder, we do our own filtering
		searchKey: `regularExpressionsSearch:${data.currentDatabase.id}`
	});

	// Extract the debounced query store for reactive access
	const debouncedQuery = search.debouncedQuery;

	// Update items when data changes (e.g., switching databases)
	$: setItems(data.regularExpressions);

	// Filtering based on active search field
	$: filtered = (() => {
		if (isTagMode) {
			return filterByTags(data.regularExpressions, searchTags, (item) =>
				item.tags.map((t) => t.name)
			);
		}
		return filterByText(data.regularExpressions, $debouncedQuery, fieldAccessors, [
			activeSearchField
		]);
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
		<ActionButton icon={Plus} hasDropdown={true} dropdownPosition="right">
			<svelte:fragment slot="dropdown">
				<Dropdown position="right">
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
		<ViewToggle bind:value={$view} />
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
					No regular expressions match your search
				</p>
			</div>
		{:else if $view === 'table'}
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
