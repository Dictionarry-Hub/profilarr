<script lang="ts">
	import { Plus, Power, Copy, ClipboardCopy, ClipboardPaste, Trash2, Pencil } from 'lucide-svelte';
	import {
		createEmptyFilterConfig,
		calculateMaxCount,
		searchRateLimits,
		resolveTagLabel,
		type FilterConfig,
		type UpgradeAppType
	} from '$shared/upgrades/filters';
	import { uuid } from '$shared/utils/uuid';
	import { selectors } from '$shared/upgrades/selectors';
	import {
		createSearchStore,
		getPersistentSearchStore,
		type SearchStore
	} from '$lib/client/stores/search';
	import type { Readable } from 'svelte/store';
	import { page } from '$app/stores';
	import FilterGroupComponent from './FilterGroup.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Button from '$ui/button/Button.svelte';
	import Card from '$ui/card/Card.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import type { Column } from '$ui/table/types';
	import { alertStore } from '$alerts/store';

	let searchStore: SearchStore = createSearchStore();
	let debouncedQuery: Readable<string> = searchStore.debouncedQuery;
	$: if ($page?.params?.id) {
		searchStore = getPersistentSearchStore(`upgradeFiltersSearch:${$page.params.id}`);
		debouncedQuery = searchStore.debouncedQuery;
	}

	export let filters: FilterConfig[] = [];
	export let appType: string = 'radarr';
	export let runsPerHour: number = 1;
	export let onFiltersChange: ((filters: FilterConfig[]) => void) | undefined = undefined;

	$: resolvedAppType = (
		appType === 'radarr' || appType === 'sonarr' ? appType : 'radarr'
	) as UpgradeAppType;
	$: countMax = calculateMaxCount(resolvedAppType, runsPerHour);

	// Auto-clamp filter counts when max decreases
	$: {
		let clamped = false;
		for (const f of filters) {
			if (f.count > countMax) {
				f.count = countMax;
				clamped = true;
			}
		}
		if (clamped) {
			filters = filters;
			notifyChange();
		}
	}

	function notifyChange() {
		onFiltersChange?.(filters);
	}

	// Filter the filters list based on search
	$: filteredFilters = filterByName(filters, $debouncedQuery);

	function filterByName(items: FilterConfig[], query: string): FilterConfig[] {
		if (!query) return items;
		const queryLower = query.toLowerCase();
		return items.filter((item) => item.name.toLowerCase().includes(queryLower));
	}

	let expandedIds: Set<string> = new Set();

	const columns: Column<FilterConfig>[] = [{ key: 'name', header: 'Name', sortable: true }];
	let editingId: string | null = null;
	let editingName: string = '';

	// Delete confirmation
	let deleteModalOpen = false;
	let filterToDelete: FilterConfig | null = null;

	function confirmDelete(filter: FilterConfig) {
		filterToDelete = filter;
		deleteModalOpen = true;
	}

	function handleDeleteConfirm() {
		if (filterToDelete) {
			filters = filters.filter((f) => f.id !== filterToDelete!.id);
			expandedIds.delete(filterToDelete.id);
			expandedIds = expandedIds;
			alertStore.add('success', `Deleted "${filterToDelete.name}"`);
			notifyChange();
		}
		deleteModalOpen = false;
		filterToDelete = null;
	}

	function handleDeleteCancel() {
		deleteModalOpen = false;
		filterToDelete = null;
	}

	function addFilter() {
		// Generate unique filter name
		let baseName = 'Filter';
		let counter = filters.length + 1;
		let name = `${baseName} ${counter}`;
		while (filters.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
			counter++;
			name = `${baseName} ${counter}`;
		}

		const newFilter = createEmptyFilterConfig(name, resolvedAppType);
		filters = [...filters, newFilter];
		expandedIds.add(newFilter.id);
		expandedIds = expandedIds;
		notifyChange();
	}

	function startEditing(filter: FilterConfig) {
		editingId = filter.id;
		editingName = filter.name;
	}

	function saveEditing() {
		if (editingId) {
			const filter = filters.find((f) => f.id === editingId);
			if (filter) {
				const trimmedName = editingName.trim();
				if (!trimmedName) {
					// Revert to original name if empty
					editingId = null;
					editingName = '';
					return;
				}
				const isDuplicate = filters.some(
					(f) => f.id !== editingId && f.name.toLowerCase() === trimmedName.toLowerCase()
				);
				if (isDuplicate) {
					alertStore.add('error', 'A filter with this name already exists');
					return;
				}
				filter.name = trimmedName;
				filters = filters;
				notifyChange();
			}
		}
		editingId = null;
		editingName = '';
	}

	function handleNameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveEditing();
		} else if (e.key === 'Escape') {
			editingId = null;
			editingName = '';
		}
	}

	function handleChange() {
		filters = filters;
		notifyChange();
	}

	function getSharedTagFilters(currentFilter: FilterConfig): string[] {
		const currentTag = resolveTagLabel(currentFilter);
		return filters
			.filter((f) => f.id !== currentFilter.id && resolveTagLabel(f) === currentTag)
			.map((f) => f.name);
	}

	function toggleEnabled(id: string) {
		const filter = filters.find((f) => f.id === id);
		if (filter) {
			filter.enabled = !filter.enabled;
			filters = filters;
			notifyChange();
		}
	}

	function duplicateFilter(id: string) {
		const filter = filters.find((f) => f.id === id);
		if (filter) {
			// Generate unique name for duplicate
			let baseName = `${filter.name} (Copy)`;
			let name = baseName;
			let counter = 1;
			while (filters.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
				counter++;
				name = `${baseName} ${counter}`;
			}

			const duplicate: FilterConfig = {
				...structuredClone(filter),
				id: uuid(),
				name
			};
			filters = [...filters, duplicate];
			expandedIds.add(duplicate.id);
			expandedIds = expandedIds;
			notifyChange();
		}
	}

	async function copyFilter(id: string) {
		const filter = filters.find((f) => f.id === id);
		if (!filter) return;

		const exportData = {
			...structuredClone(filter),
			id: undefined
		};

		try {
			await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
			alertStore.add('success', 'Filter copied to clipboard');
		} catch {
			alertStore.add('error', 'Failed to copy to clipboard');
		}
	}

	async function pasteIntoFilter(id: string) {
		const filter = filters.find((f) => f.id === id);
		if (!filter) return;

		try {
			const text = await navigator.clipboard.readText();
			const imported = JSON.parse(text);

			if (!imported.group) {
				alertStore.add('error', 'Invalid filter format');
				return;
			}

			// Overwrite filter settings but keep id and name
			filter.group = imported.group;
			filter.selector = imported.selector ?? filter.selector;
			filter.count = imported.count ?? filter.count;
			filter.cutoff = imported.cutoff ?? filter.cutoff;
			filter.enabled = imported.enabled ?? filter.enabled;

			filters = filters;
			notifyChange();
			alertStore.add('success', `Pasted settings into "${filter.name}"`);
		} catch {
			alertStore.add('error', 'Failed to paste from clipboard');
		}
	}
</script>

<div class="-mx-4 bg-neutral-50 px-4 pt-2 pb-6 md:-mx-8 md:px-8 dark:bg-neutral-900">
	<div class="mb-4">
		<ActionsBar>
			<SearchAction {searchStore} placeholder="Search filters..." />
			<ActionButton icon={Plus} title="Add filter" on:click={addFilter} />
		</ActionsBar>
	</div>

	<ExpandableTable
		{columns}
		data={filteredFilters}
		getRowId={(row) => row.id}
		bind:expandedRows={expandedIds}
		chevronPosition="right"
		flushExpanded={true}
		emptyMessage="No filters configured. Add a filter to start."
		responsive
	>
		<svelte:fragment slot="cell" let:row let:column>
			{#if column.key === 'name'}
				<div class="flex flex-col gap-2">
					<div class="flex items-center gap-1.5">
						{#if editingId === row.id}
							<!-- svelte-ignore a11y_autofocus -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="w-48" on:click|stopPropagation on:keydown={handleNameKeydown}>
								<FormInput
									label="Filter name"
									hideLabel
									name="filter-name-{row.id}"
									bind:value={editingName}
									on:blur={() => saveEditing()}
								/>
							</div>
						{:else}
							<span
								class={row.enabled
									? 'text-neutral-900 dark:text-neutral-100'
									: 'text-neutral-400 dark:text-neutral-500'}
							>
								{row.name}
							</span>
							<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
							<div on:click|stopPropagation>
								<Button icon={Pencil} size="xs" on:click={() => startEditing(row)} />
							</div>
							{#if !row.enabled}
								<span
									class="rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"
								>
									Disabled
								</span>
							{/if}
						{/if}
					</div>
					<!-- Mobile: buttons below name -->
					<div class="flex flex-wrap items-center gap-1 md:hidden">
						<Button
							text={row.enabled ? 'Disable' : 'Enable'}
							icon={Power}
							iconColor={row.enabled
								? 'text-green-600 dark:text-green-400'
								: 'text-neutral-400 dark:text-neutral-500'}
							on:click={() => toggleEnabled(row.id)}
						/>
						<Button
							text="Copy"
							icon={ClipboardCopy}
							iconColor="text-amber-600 dark:text-amber-400"
							on:click={() => copyFilter(row.id)}
						/>
						<Button
							text="Paste"
							icon={ClipboardPaste}
							iconColor="text-amber-600 dark:text-amber-400"
							on:click={() => pasteIntoFilter(row.id)}
						/>
						<Button
							text="Duplicate"
							icon={Copy}
							iconColor="text-violet-600 dark:text-violet-400"
							on:click={() => duplicateFilter(row.id)}
						/>
						<Button
							text="Delete"
							icon={Trash2}
							iconColor="text-red-600 dark:text-red-400"
							on:click={() => confirmDelete(row)}
						/>
					</div>
				</div>
			{/if}
		</svelte:fragment>

		<!-- Desktop: buttons in actions slot -->
		<svelte:fragment slot="actions" let:row>
			<div class="hidden items-center gap-1 md:flex">
				<Button
					text={row.enabled ? 'Disable' : 'Enable'}
					icon={Power}
					iconColor={row.enabled
						? 'text-green-600 dark:text-green-400'
						: 'text-neutral-400 dark:text-neutral-500'}
					on:click={() => toggleEnabled(row.id)}
				/>
				<Button
					text="Copy"
					icon={ClipboardCopy}
					iconColor="text-amber-600 dark:text-amber-400"
					on:click={() => copyFilter(row.id)}
				/>
				<Button
					text="Paste"
					icon={ClipboardPaste}
					iconColor="text-amber-600 dark:text-amber-400"
					on:click={() => pasteIntoFilter(row.id)}
				/>
				<Button
					text="Duplicate"
					icon={Copy}
					iconColor="text-violet-600 dark:text-violet-400"
					on:click={() => duplicateFilter(row.id)}
				/>
				<Button
					text="Delete"
					icon={Trash2}
					iconColor="text-red-600 dark:text-red-400"
					on:click={() => confirmDelete(row)}
				/>
			</div>
		</svelte:fragment>

		<svelte:fragment slot="expanded" let:row>
			<div class="space-y-4 p-6">
				<FilterGroupComponent
					group={row.group}
					appType={resolvedAppType}
					on:change={handleChange}
				/>

				<!-- Selection Settings -->
				<Card flush padding="md">
					<h3 class="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">Settings</h3>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
						<div>
							<label
								for="cutoff-{row.id}"
								class="block text-sm font-medium text-neutral-600 dark:text-neutral-400"
							>
								Cutoff %
							</label>
							<div class="mt-1">
								<NumberInput
									name="cutoff-{row.id}"
									bind:value={row.cutoff}
									min={0}
									max={100}
									font="mono"
									responsive
									on:change={handleChange}
								/>
							</div>
							<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
								Score threshold for "cutoff met"
							</p>
						</div>
						<div>
							<label
								for="selector-{row.id}"
								class="mb-1 block text-sm font-medium text-neutral-600 dark:text-neutral-400"
							>
								Method
							</label>
							<div class="mt-1">
								<DropdownSelect
									value={row.selector}
									options={selectors.map((s) => ({
										value: s.id,
										label: `${s.label} - ${s.description}`,
										shortLabel: s.label
									}))}
									minWidth="14rem"
									compactDropdownThreshold={7}
									fullWidth
									fixed
									on:change={(e) => {
										row.selector = e.detail;
										handleChange();
									}}
								/>
							</div>
						</div>
						<div>
							<label
								for="count-{row.id}"
								class="block text-sm font-medium text-neutral-600 dark:text-neutral-400"
							>
								Count
							</label>
							<div class="mt-1">
								<NumberInput
									name="count-{row.id}"
									bind:value={row.count}
									min={1}
									max={countMax}
									font="mono"
									responsive
									on:change={handleChange}
								/>
							</div>
							<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
								Items per run (max {countMax} at this schedule)
							</p>
						</div>
						<div>
							<label
								for="tag-{row.id}"
								class="block text-sm font-medium text-neutral-600 dark:text-neutral-400"
							>
								Cooldown Tag
							</label>
							<div class="mt-1">
								<FormInput
									label="Cooldown tag"
									hideLabel
									lowercase
									name="tag-{row.id}"
									placeholder={resolveTagLabel(row)}
									bind:value={row.tag}
									on:input={handleChange}
								/>
							</div>
							{#if getSharedTagFilters(row).length > 0}
								<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
									Shared with: {getSharedTagFilters(row).join(', ')}
								</p>
							{:else}
								<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
									Tag applied in your arr instance for cooldown tracking. Avoid reusing tags you use
									elsewhere.
								</p>
							{/if}
						</div>
					</div>
				</Card>
			</div>
		</svelte:fragment>
	</ExpandableTable>
</div>

<Modal
	bind:open={deleteModalOpen}
	header="Delete Filter"
	bodyMessage="Are you sure you want to delete &quot;{filterToDelete?.name}&quot;? This action cannot be undone."
	confirmText="Delete"
	confirmDanger={true}
	on:confirm={handleDeleteConfirm}
	on:cancel={handleDeleteCancel}
/>
