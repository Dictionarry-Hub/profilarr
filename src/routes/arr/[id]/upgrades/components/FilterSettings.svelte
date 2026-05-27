<script lang="ts">
	import {
		Plus,
		Power,
		Copy,
		ClipboardCopy,
		FileJson,
		FileText,
		Trash2,
		Pencil,
		Eye,
		Loader2,
		CircleDot
	} from 'lucide-svelte';
	import {
		createEmptyFilterConfig,
		calculateMaxCount,
		getFilterField,
		isGroup,
		isRule,
		searchRateLimits,
		resolveTagLabel,
		type DynamicFilterOptions,
		type FilterConfig,
		type FilterGroup,
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
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Button from '$ui/button/Button.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import PasteModal from '$ui/modal/PasteModal.svelte';
	import Label from '$ui/label/Label.svelte';
	import CustomFormatBadge from '$ui/arr/CustomFormatBadge.svelte';
	import type { Column } from '$ui/table/types';
	import { alertStore } from '$alerts/store';
	import { copyToClipboard } from '$lib/client/utils/clipboard';

	let searchStore: SearchStore = createSearchStore();
	let debouncedQuery: Readable<string> = searchStore.debouncedQuery;
	let previewSearchStore: SearchStore = createSearchStore();
	let previewDebouncedQuery: Readable<string> = previewSearchStore.debouncedQuery;
	$: if ($page?.params?.id) {
		searchStore = getPersistentSearchStore(`upgradeFiltersSearch:${$page.params.id}`);
		debouncedQuery = searchStore.debouncedQuery;
	}

	export let filters: FilterConfig[] = [];
	export let appType: string = 'radarr';
	export let runsPerHour: number = 1;
	export let dynamicFilterOptions: DynamicFilterOptions = {};
	export let dynamicFilterOptionsLoading: boolean = false;
	export let dynamicFilterOptionsVersion: number = 0;
	export let onFiltersChange: ((filters: FilterConfig[]) => void) | undefined = undefined;

	$: resolvedAppType = (
		appType === 'radarr' || appType === 'sonarr' ? appType : 'radarr'
	) as UpgradeAppType;
	$: countMax = calculateMaxCount(resolvedAppType, runsPerHour);
	const selectorShortDescriptions: Record<string, string> = {
		random: 'Any order',
		oldest: 'Oldest first',
		newest: 'Newest first',
		lowest_score: 'Lowest score',
		most_popular: 'Most popular',
		least_popular: 'Least popular',
		alphabetical_asc: 'A-Z',
		alphabetical_desc: 'Z-A'
	};

	type PreviewStatus = 'selected' | 'selectable' | 'cooldown' | 'filtered_out';
	type PreviewLabelVariant = 'secondary' | 'success' | 'warning' | 'info';

	interface PreviewItem {
		id: number;
		title: string;
		year: number;
		status: PreviewStatus;
		reason: string;
		details: PreviewDetails;
	}

	interface PreviewFormat {
		name: string;
		score: number;
	}

	interface PreviewDetails {
		qualityProfile: string;
		fileName: string;
		customFormats: PreviewFormat[];
		score: number;
		tags: string[];
		monitored: boolean;
		dateAdded: string;
		sizeOnDisk: number;
		releaseGroup: string;
		status: string;
	}

	interface PreviewResult {
		filterName: string;
		totalItems: number;
		matchedCount: number;
		cooldownCount: number;
		selectableCount: number;
		selectedCount: number;
		requestedCount: number;
		selector: string;
		items: PreviewItem[];
	}

	const previewStatusMeta: Record<
		PreviewStatus,
		{ label: string; variant: PreviewLabelVariant }
	> = {
		selected: { label: 'Will search next', variant: 'success' },
		selectable: { label: 'Eligible later', variant: 'info' },
		cooldown: { label: 'Already searched', variant: 'warning' },
		filtered_out: { label: "Doesn't match", variant: 'secondary' }
	};
	const previewStatusOptions: { value: PreviewStatus; label: string }[] = [
		{ value: 'selected', label: 'Will search next' },
		{ value: 'selectable', label: 'Eligible later' },
		{ value: 'cooldown', label: 'Already searched' },
		{ value: 'filtered_out', label: "Doesn't match" }
	];
	const previewSkeletonRows = Array.from({ length: 8 });

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
	const previewColumns: Column<PreviewItem>[] = [
		{ key: 'title', header: 'Title', sortable: true, width: 'w-64' },
		{ key: 'status', header: 'Status', width: 'w-32' },
		{ key: 'reason', header: 'Reason' }
	];
	let editingId: string | null = null;
	let editingName: string = '';

	// Delete confirmation
	let deleteModalOpen = false;
	let filterToDelete: FilterConfig | null = null;
	let pasteModalOpen = false;
	let previewModalOpen = false;
	let previewFilter: FilterConfig | null = null;
	let previewLoading = false;
	let previewLoadingText = 'Loading library data...';
	let previewError: string | null = null;
	let previewData: PreviewResult | null = null;
	let previewStatusFilters: Set<PreviewStatus> = new Set();
	let previewExpandedIds: Set<string | number> = new Set();
	let previewRequestId = 0;
	let previewStepTimer: ReturnType<typeof setTimeout> | undefined;

	$: filteredPreviewItems = filterPreviewItems(
		previewData?.items ?? [],
		$previewDebouncedQuery,
		previewStatusFilters
	);

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
		const name = getUniqueFilterName('Filter', filters.length + 1);

		const newFilter = createEmptyFilterConfig(name, resolvedAppType);
		filters = [...filters, newFilter];
		expandedIds.add(newFilter.id);
		expandedIds = expandedIds;
		notifyChange();
	}

	function getUniqueFilterName(baseName: string, startCounter = 1): string {
		let name = startCounter > 1 ? `${baseName} ${startCounter}` : baseName;
		let counter = startCounter;
		while (filters.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
			counter++;
			name = `${baseName} ${counter}`;
		}
		return name;
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

		const copied = await copyToClipboard(JSON.stringify(exportData, null, 2));
		if (copied) {
			alertStore.add('success', 'Filter copied to clipboard');
		} else {
			alertStore.add('error', 'Failed to copy to clipboard');
		}
	}

	function handlePasteConfirm(text: string) {
		try {
			const imported = JSON.parse(text);

			if (!imported.group) {
				alertStore.add('error', 'Invalid filter format');
				pasteModalOpen = false;
				return;
			}

			const invalidFields = findInvalidFilterFields(imported.group);
			if (invalidFields.length > 0) {
				alertStore.add('error', buildInvalidFieldsMessage(invalidFields));
				pasteModalOpen = false;
				return;
			}

			const baseName =
				typeof imported.name === 'string' && imported.name.trim()
					? imported.name.trim()
					: 'Imported Filter';
			const fallbackFilter = createEmptyFilterConfig(
				getUniqueFilterName(baseName),
				resolvedAppType
			);
			const importedFilter: FilterConfig = {
				...fallbackFilter,
				group: imported.group,
				selector: imported.selector ?? fallbackFilter.selector,
				count: imported.count ?? fallbackFilter.count,
				cutoff: imported.cutoff ?? fallbackFilter.cutoff,
				enabled: imported.enabled ?? fallbackFilter.enabled,
				tag: imported.tag ?? fallbackFilter.tag
			};

			filters = [...filters, importedFilter];
			expandedIds.add(importedFilter.id);
			expandedIds = expandedIds;
			notifyChange();
			alertStore.add('success', `Imported "${importedFilter.name}"`);
			pasteModalOpen = false;
		} catch {
			alertStore.add('error', 'Failed to paste from clipboard');
			pasteModalOpen = false;
		}
	}

	function findInvalidFilterFields(group: FilterGroup): string[] {
		const invalid = new Set<string>();

		function visit(currentGroup: FilterGroup) {
			for (const child of currentGroup.children) {
				if (isRule(child)) {
					if (!getFilterField(child.field, resolvedAppType)) {
						invalid.add(child.field);
					}
					continue;
				}

				if (isGroup(child)) {
					visit(child);
				}
			}
		}

		visit(group);
		return [...invalid].sort();
	}

	function buildInvalidFieldsMessage(fields: string[]): string {
		const appLabel = resolvedAppType === 'sonarr' ? 'Sonarr' : 'Radarr';
		if (fields.length === 1) {
			return `Cannot import filter: "${fields[0]}" is not available for ${appLabel}.`;
		}

		return `Cannot import filter: these fields are not available for ${appLabel}: ${fields.join(
			', '
		)}.`;
	}

	function handlePasteCancel() {
		pasteModalOpen = false;
	}

	function clearPreviewStepTimer() {
		if (previewStepTimer) {
			clearTimeout(previewStepTimer);
			previewStepTimer = undefined;
		}
	}

	function resetPreviewFilters() {
		previewSearchStore.clear();
		previewStatusFilters = new Set();
		previewExpandedIds = new Set();
	}

	function filterPreviewItems(
		items: PreviewItem[],
		query: string,
		statuses: Set<PreviewStatus>
	): PreviewItem[] {
		let result = items;
		const queryLower = query.trim().toLowerCase();

		if (queryLower) {
			result = result.filter(
				(item) =>
					item.title.toLowerCase().includes(queryLower) ||
					item.reason.toLowerCase().includes(queryLower) ||
					previewStatusMeta[item.status].label.toLowerCase().includes(queryLower)
			);
		}

		if (statuses.size > 0) {
			result = result.filter((item) => statuses.has(item.status));
		}

		return result;
	}

	function togglePreviewStatus(status: PreviewStatus) {
		if (previewStatusFilters.has(status)) {
			previewStatusFilters.delete(status);
		} else {
			previewStatusFilters.add(status);
		}
		previewStatusFilters = new Set(previewStatusFilters);
	}

	function clearPreviewStatusFilters() {
		previewStatusFilters = new Set();
	}

	async function openPreview(filter: FilterConfig) {
		const requestId = previewRequestId + 1;
		previewRequestId = requestId;
		previewFilter = filter;
		previewModalOpen = true;
		previewLoading = true;
		previewLoadingText = 'Loading library data...';
		previewError = null;
		previewData = null;
		resetPreviewFilters();
		clearPreviewStepTimer();
		previewStepTimer = setTimeout(() => {
			if (requestId === previewRequestId) {
				previewLoadingText = 'Evaluating filter...';
			}
		}, 700);

		try {
			const instanceId = $page.params.id;
			if (!instanceId) {
				throw new Error('Invalid instance ID');
			}

			const response = await fetch(`/arr/${instanceId}/upgrades/preview`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ filter: structuredClone(filter) })
			});
			const result = await response.json().catch(() => ({}));

			if (requestId !== previewRequestId) {
				return;
			}

			if (!response.ok) {
				throw new Error(result.error ?? 'Failed to preview filter');
			}

			previewData = result as PreviewResult;
		} catch (err) {
			if (requestId === previewRequestId) {
				previewError = err instanceof Error ? err.message : 'Failed to preview filter';
			}
		} finally {
			if (requestId === previewRequestId) {
				clearPreviewStepTimer();
				previewLoading = false;
			}
		}
	}

	function closePreview() {
		previewRequestId += 1;
		clearPreviewStepTimer();
		previewModalOpen = false;
		previewLoading = false;
		previewFilter = null;
		previewData = null;
	}

	function formatPreviewSize(sizeGb: number): string {
		if (!sizeGb) return 'None';
		if (sizeGb >= 1) return `${sizeGb.toFixed(1)} GB`;
		return `${Math.round(sizeGb * 1024)} MB`;
	}

	function formatPreviewDate(value: string): string {
		if (!value) return 'Unknown';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return 'Unknown';
		return date.toLocaleDateString();
	}

	function formatPreviewScore(score: number): string {
		return score.toLocaleString();
	}

	function formatPreviewStatus(status: string): string {
		if (!status) return 'Unknown';
		return status
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.replace(/_/g, ' ')
			.replace(/\b\w/g, (letter) => letter.toUpperCase());
	}

	function previewStatusVariant(status: string): PreviewLabelVariant {
		switch (status) {
			case 'released':
			case 'continuing':
				return 'success';
			case 'inCinemas':
			case 'upcoming':
				return 'info';
			default:
				return 'secondary';
		}
	}

	function formatPreviewCount(value: number): string {
		return value.toLocaleString();
	}

	function formatPreviewItemCount(count: number, singular: string, plural: string): string {
		return `${formatPreviewCount(count)} ${count === 1 ? singular : plural}`;
	}

	function getPreviewSelectorLabel(selectorId: string): string {
		return selectors.find((selector) => selector.id === selectorId)?.label ?? selectorId;
	}

	function getPreviewEligibleLaterCount(data: PreviewResult): number {
		return Math.max(0, data.selectableCount - data.selectedCount);
	}

	function getPreviewDoesNotMatchCount(data: PreviewResult): number {
		return Math.max(0, data.totalItems - data.matchedCount);
	}
</script>

<div class="-mx-4 bg-neutral-50 px-4 pt-2 pb-2 md:-mx-8 md:px-8 dark:bg-neutral-900">
	<div class="mb-4">
		<ActionsBar>
			<SearchAction {searchStore} placeholder="Search filters..." />
			<ActionButton
				icon={Plus}
				title="Add filter"
				onboarding="upgrades-add-filter"
				hasDropdown={true}
				dropdownPosition="right"
			>
				<svelte:fragment slot="dropdown">
					<Dropdown position="right" minWidth="12rem">
						<DropdownHeader label="New filter" />
						<DropdownItem icon={FileText} label="Default" on:click={addFilter} />
						<DropdownItem icon={FileJson} label="Import" on:click={() => (pasteModalOpen = true)} />
					</Dropdown>
				</svelte:fragment>
			</ActionButton>
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
							icon={Eye}
							iconColor="text-blue-600 dark:text-blue-400"
							tooltip="Preview"
							on:click={() => openPreview(row)}
						/>
						<Button
							icon={Power}
							iconColor={row.enabled
								? 'text-green-600 dark:text-green-400'
								: 'text-neutral-400 dark:text-neutral-500'}
							tooltip={row.enabled ? 'Disable' : 'Enable'}
							on:click={() => toggleEnabled(row.id)}
						/>
						<Button
							icon={ClipboardCopy}
							iconColor="text-amber-600 dark:text-amber-400"
							tooltip="Copy"
							on:click={() => copyFilter(row.id)}
						/>
						<Button
							icon={Copy}
							iconColor="text-violet-600 dark:text-violet-400"
							tooltip="Duplicate"
							on:click={() => duplicateFilter(row.id)}
						/>
						<Button
							icon={Trash2}
							iconColor="text-red-600 dark:text-red-400"
							tooltip="Delete"
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
					icon={Eye}
					iconColor="text-blue-600 dark:text-blue-400"
					tooltip="Preview"
					on:click={() => openPreview(row)}
				/>
				<Button
					icon={Power}
					iconColor={row.enabled
						? 'text-green-600 dark:text-green-400'
						: 'text-neutral-400 dark:text-neutral-500'}
					tooltip={row.enabled ? 'Disable' : 'Enable'}
					on:click={() => toggleEnabled(row.id)}
				/>
				<Button
					icon={ClipboardCopy}
					iconColor="text-amber-600 dark:text-amber-400"
					tooltip="Copy"
					on:click={() => copyFilter(row.id)}
				/>
				<Button
					icon={Copy}
					iconColor="text-violet-600 dark:text-violet-400"
					tooltip="Duplicate"
					on:click={() => duplicateFilter(row.id)}
				/>
				<Button
					icon={Trash2}
					iconColor="text-red-600 dark:text-red-400"
					tooltip="Delete"
					on:click={() => confirmDelete(row)}
				/>
			</div>
		</svelte:fragment>

		<svelte:fragment slot="expanded" let:row>
			<div class="space-y-4 p-3 md:p-6">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
					<div data-onboarding="upgrades-cutoff">
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
					<div data-onboarding="upgrades-method">
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
									label: s.label
								}))}
								minWidth="14rem"
								fullWidth
								responsiveButton
								responsiveDropdown
								fixed
								on:change={(e) => {
									row.selector = e.detail;
									handleChange();
								}}
							/>
						</div>
						<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
							{selectorShortDescriptions[row.selector] ?? 'Selection order'}
						</p>
					</div>
					<div data-onboarding="upgrades-count">
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
					<div data-onboarding="upgrades-cooldown" class="lg:col-span-2">
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
								responsive
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

				<hr class="-mx-3 border-t border-neutral-200 md:-mx-6 dark:border-neutral-800" />

				<div data-onboarding="upgrades-filter-rules">
					<FilterGroupComponent
						group={row.group}
						appType={resolvedAppType}
						{dynamicFilterOptions}
						{dynamicFilterOptionsLoading}
						{dynamicFilterOptionsVersion}
						on:change={handleChange}
					/>
				</div>
			</div></svelte:fragment
		>
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

<Modal
	open={previewModalOpen}
	header={previewFilter ? `Preview: ${previewFilter.name}` : 'Preview Filter'}
	size="2xl"
	height="xl"
	on:cancel={closePreview}
>
	<svelte:fragment slot="body">
		{#if previewLoading}
			<div class="space-y-4">
				<div class="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
					<Loader2 size={16} class="animate-spin text-blue-600 dark:text-blue-400" />
					<span>{previewLoadingText}</span>
				</div>
				<div
					class="overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700/60"
				>
					{#each previewSkeletonRows as _}
						<div class="flex gap-4 border-b border-neutral-200 p-4 last:border-0 dark:border-neutral-800">
							<div class="h-4 w-2/5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
							<div class="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
							<div class="h-4 w-28 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
							<div class="h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
						</div>
					{/each}
				</div>
			</div>
		{:else if previewError}
			<div
				class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
			>
				{previewError}
			</div>
		{:else if previewData}
			<div class="space-y-4">
				<div
					class="space-y-3 rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700/60 dark:bg-neutral-900"
				>
					<div class="flex">
						<span class="w-24 shrink-0 text-sm font-medium text-neutral-500 dark:text-neutral-400">
							Library
						</span>
						<span class="text-sm text-neutral-900 dark:text-neutral-100">
							{formatPreviewItemCount(previewData.totalItems, 'item', 'items')} checked
						</span>
					</div>

					<div class="flex">
						<span class="w-24 shrink-0 text-sm font-medium text-neutral-500 dark:text-neutral-400">
							Filter
						</span>
						<span class="text-sm text-neutral-900 dark:text-neutral-100">
							"{previewData.filterName}"
							<span class="mx-1 text-neutral-400">&rarr;</span>
							<span class="font-mono font-medium">{formatPreviewCount(previewData.matchedCount)}</span>
							matched
							<span class="mx-1 text-neutral-400">&rarr;</span>
							<span class="font-mono font-medium">{formatPreviewCount(previewData.selectableCount)}</span>
							after cooldown
						</span>
					</div>

					<div class="flex">
						<span class="w-24 shrink-0 text-sm font-medium text-neutral-500 dark:text-neutral-400">
							Selection
						</span>
						<span class="text-sm text-neutral-900 dark:text-neutral-100">
							{getPreviewSelectorLabel(previewData.selector)}
							<span class="font-mono font-medium">{formatPreviewCount(previewData.selectedCount)}</span>
							of <span class="font-mono">{formatPreviewCount(previewData.requestedCount)}</span>
							will search next
							{#if getPreviewEligibleLaterCount(previewData) > 0}
								<span class="mx-1 text-neutral-400">&rarr;</span>
								{formatPreviewItemCount(getPreviewEligibleLaterCount(previewData), 'item', 'items')}
								eligible later
							{/if}
						</span>
					</div>

					<div class="flex">
						<span class="w-24 shrink-0 text-sm font-medium text-neutral-500 dark:text-neutral-400">
							Cooldown
						</span>
						<span class="text-sm text-neutral-900 dark:text-neutral-100">
							{formatPreviewItemCount(previewData.cooldownCount, 'item', 'items')} already
							searched,
							{formatPreviewItemCount(
								getPreviewDoesNotMatchCount(previewData),
								'item does',
								'items do'
							)}
							not match
						</span>
					</div>
				</div>

				<ActionsBar className="md:justify-start">
					<SearchAction
						searchStore={previewSearchStore}
						placeholder="Search items..."
						responsive
					/>
					<ActionButton icon={CircleDot} hasDropdown square title="Filter by status">
						<svelte:fragment slot="dropdown">
							<Dropdown position="right" mobilePosition="middle" minWidth="12rem">
								<DropdownHeader label="Status" />
								<DropdownItem
									label="All statuses"
									selected={previewStatusFilters.size === 0}
									on:click={clearPreviewStatusFilters}
								/>
								{#each previewStatusOptions as option}
									<DropdownItem
										label={option.label}
										selected={previewStatusFilters.has(option.value)}
										on:click={() => togglePreviewStatus(option.value)}
									/>
								{/each}
							</Dropdown>
						</svelte:fragment>
					</ActionButton>
				</ActionsBar>

				<ExpandableTable
					columns={previewColumns}
					data={filteredPreviewItems}
					getRowId={(row) => row.id}
					bind:expandedRows={previewExpandedIds}
					compact
					responsive
					flushExpanded
					fixedLayout
					pageSize={100}
					emptyMessage="No preview items match."
				>
					<svelte:fragment slot="cell" let:row let:column>
						{#if column.key === 'title'}
							<div class="min-w-0">
								<div class="truncate font-medium">{row.title}</div>
								<div class="text-xs text-neutral-500 dark:text-neutral-400">{row.year}</div>
							</div>
						{:else if column.key === 'status'}
							<Label variant={previewStatusMeta[row.status].variant} size="sm" rounded="md">
								{previewStatusMeta[row.status].label}
							</Label>
						{:else if column.key === 'reason'}
							<span class="break-words text-neutral-600 dark:text-neutral-300">
								{row.reason}
							</span>
						{/if}
					</svelte:fragment>

					<svelte:fragment slot="expanded" let:row>
						<div class="min-w-0 overflow-hidden p-4">
							<div class="divide-y divide-neutral-200 dark:divide-neutral-800">
								<div class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center">
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										File on Disk
									</div>
									<div class="min-w-0">
										{#if row.details.fileName}
											<code
												class="font-mono text-xs break-all text-neutral-600 dark:text-neutral-400"
											>
												{row.details.fileName}
											</code>
										{:else}
											<div class="text-xs text-neutral-500 dark:text-neutral-400">No file</div>
										{/if}
									</div>
								</div>

								<div class="grid grid-cols-1 gap-2 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center">
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										Custom Formats
									</div>
									<div class="min-w-0">
										{#if row.details.customFormats.length > 0}
											<div class="flex min-w-0 flex-wrap items-center gap-2">
												{#each [...row.details.customFormats].sort((a, b) => b.score - a.score) as item}
													<CustomFormatBadge name={item.name} score={item.score} />
												{/each}
											</div>
										{:else}
											<div class="text-xs text-neutral-500 dark:text-neutral-400">
												No custom formats matched
											</div>
										{/if}
									</div>
								</div>

								<div class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center">
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										Profile
									</div>
									<div class="min-w-0 break-words text-sm text-neutral-900 dark:text-neutral-100">
										{row.details.qualityProfile}
									</div>
								</div>

								<div class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center">
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										Score
									</div>
									<div class="font-mono text-sm text-neutral-900 dark:text-neutral-100">
										{formatPreviewScore(row.details.score)}
									</div>
								</div>

								<div class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center">
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										Monitored
									</div>
									<div>
										<Label
											variant={row.details.monitored ? 'success' : 'secondary'}
											size="sm"
											rounded="md"
										>
											{row.details.monitored ? 'Yes' : 'No'}
										</Label>
									</div>
								</div>

								<div class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center">
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										Status
									</div>
									<div>
										<Label
											variant={previewStatusVariant(row.details.status)}
											size="sm"
											rounded="md"
										>
											{formatPreviewStatus(row.details.status)}
										</Label>
									</div>
								</div>

								<div class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center">
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										Size
									</div>
									<div class="font-mono text-sm text-neutral-900 dark:text-neutral-100">
										{formatPreviewSize(row.details.sizeOnDisk)}
									</div>
								</div>

								<div class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center">
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										Added
									</div>
									<div class="font-mono text-sm text-neutral-900 dark:text-neutral-100">
										{formatPreviewDate(row.details.dateAdded)}
									</div>
								</div>

								<div class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center">
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										Release Group
									</div>
									<div
										class="min-w-0 break-words font-mono text-sm text-neutral-900 dark:text-neutral-100"
									>
										{row.details.releaseGroup || 'None'}
									</div>
								</div>

								<div class="grid grid-cols-1 gap-2 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center">
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										Tags
									</div>
									<div class="min-w-0">
										{#if row.details.tags.length > 0}
											<div class="flex min-w-0 flex-wrap items-center gap-2">
												{#each row.details.tags as tag}
													<Label variant="secondary" size="sm" rounded="md">{tag}</Label>
												{/each}
											</div>
										{:else}
											<div class="text-xs text-neutral-500 dark:text-neutral-400">No tags</div>
										{/if}
									</div>
								</div>
							</div>
						</div>
					</svelte:fragment>
				</ExpandableTable>
			</div>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<div class="flex w-full justify-end">
			<Button text="Close" on:click={closePreview} />
		</div>
	</svelte:fragment>
</Modal>

<PasteModal
	open={pasteModalOpen}
	header="Import Filter"
	label="Filter JSON"
	description="Paste copied filter JSON to create a new filter."
	placeholder={'{\n  "group": { ... }\n}'}
	confirmText="Import"
	on:confirm={(e) => handlePasteConfirm(e.detail)}
	on:cancel={handlePasteCancel}
/>
