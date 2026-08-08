<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { CircleDot, Loader2 } from '@lucide/svelte';
	import type { FilterConfig } from '$shared/upgrades/filters';
	import { selectors } from '$shared/upgrades/selectors';
	import { createSearchStore, type SearchStore } from '$lib/client/stores/search';
	import { serverTimezone } from '$lib/client/stores/timezone';
	import { formatDate } from '$shared/utils/dates';
	import type { Readable } from 'svelte/store';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import Button from '$ui/button/Button.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import Label from '$ui/label/Label.svelte';
	import CustomFormatBadge from '$ui/arr/CustomFormatBadge.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import type { Column } from '$ui/table/types';

	export let open = false;
	export let filter: FilterConfig | null = null;
	export let instanceId: string | undefined = undefined;

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

	const dispatch = createEventDispatcher<{ close: void }>();

	let searchStore: SearchStore = createSearchStore();
	let debouncedQuery: Readable<string> = searchStore.debouncedQuery;
	let loading = false;
	let loadingText = 'Loading library data...';
	let error: string | null = null;
	let data: PreviewResult | null = null;
	let statusFilters: Set<PreviewStatus> = new Set();
	let expandedIds: Set<string | number> = new Set();
	let requestId = 0;
	let stepTimer: ReturnType<typeof setTimeout> | undefined;
	let activePreviewKey = '';

	const columns: Column<PreviewItem>[] = [
		{ key: 'title', header: 'Title', sortable: true, width: 'w-64' },
		{ key: 'status', header: 'Status', width: 'w-32' },
		{ key: 'reason', header: 'Reason' }
	];
	const statusMeta: Record<PreviewStatus, { label: string; variant: PreviewLabelVariant }> = {
		selected: { label: 'Will search next', variant: 'success' },
		selectable: { label: 'Eligible later', variant: 'info' },
		cooldown: { label: 'Already searched', variant: 'warning' },
		filtered_out: { label: "Doesn't match", variant: 'secondary' }
	};
	const statusOptions: { value: PreviewStatus; label: string }[] = [
		{ value: 'selected', label: 'Will search next' },
		{ value: 'selectable', label: 'Eligible later' },
		{ value: 'cooldown', label: 'Already searched' },
		{ value: 'filtered_out', label: "Doesn't match" }
	];
	const skeletonRows = Array.from({ length: 8 });

	$: filteredItems = filterItems(data?.items ?? [], $debouncedQuery, statusFilters);
	$: previewKey = open && filter && instanceId ? `${instanceId}:${filter.id}` : '';
	$: if (previewKey && previewKey !== activePreviewKey && filter && instanceId) {
		activePreviewKey = previewKey;
		void loadPreview(filter, instanceId);
	}
	$: if (!open && activePreviewKey) {
		activePreviewKey = '';
		requestId += 1;
		clearStepTimer();
		loading = false;
	}

	function clearStepTimer() {
		if (stepTimer) {
			clearTimeout(stepTimer);
			stepTimer = undefined;
		}
	}

	function resetFilters() {
		searchStore.clear();
		statusFilters = new Set();
		expandedIds = new Set();
	}

	function filterItems(
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
					statusMeta[item.status].label.toLowerCase().includes(queryLower)
			);
		}

		if (statuses.size > 0) {
			result = result.filter((item) => statuses.has(item.status));
		}

		return result;
	}

	function toggleStatus(status: PreviewStatus) {
		if (statusFilters.has(status)) {
			statusFilters.delete(status);
		} else {
			statusFilters.add(status);
		}
		statusFilters = new Set(statusFilters);
	}

	function clearStatusFilters() {
		statusFilters = new Set();
	}

	async function loadPreview(targetFilter: FilterConfig, targetInstanceId: string) {
		const currentRequestId = requestId + 1;
		requestId = currentRequestId;
		loading = true;
		loadingText = 'Loading library data...';
		error = null;
		data = null;
		resetFilters();
		clearStepTimer();
		stepTimer = setTimeout(() => {
			if (currentRequestId === requestId) {
				loadingText = 'Evaluating filter...';
			}
		}, 700);

		try {
			const response = await fetch(`/arr/${targetInstanceId}/upgrades/preview`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ filter: structuredClone(targetFilter) })
			});
			const result = await response.json().catch(() => ({}));

			if (currentRequestId !== requestId) {
				return;
			}

			if (!response.ok) {
				throw new Error(result.error ?? 'Failed to preview filter');
			}

			data = result as PreviewResult;
		} catch (err) {
			if (currentRequestId === requestId) {
				error = err instanceof Error ? err.message : 'Failed to preview filter';
			}
		} finally {
			if (currentRequestId === requestId) {
				clearStepTimer();
				loading = false;
			}
		}
	}

	function closePreview() {
		requestId += 1;
		clearStepTimer();
		loading = false;
		data = null;
		dispatch('close');
	}

	function formatSize(sizeGb: number): string {
		if (!sizeGb) return 'None';
		if (sizeGb >= 1) return `${sizeGb.toFixed(1)} GB`;
		return `${Math.round(sizeGb * 1024)} MB`;
	}

	function formatDateValue(value: string): string {
		if (!value) return 'Unknown';
		const result = formatDate(value, $serverTimezone);
		return result === '-' ? 'Unknown' : result;
	}

	function formatScore(score: number): string {
		return score.toLocaleString();
	}

	function formatStatus(status: string): string {
		if (!status) return 'Unknown';
		return status
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.replace(/_/g, ' ')
			.replace(/\b\w/g, (letter) => letter.toUpperCase());
	}

	function statusVariant(status: string): PreviewLabelVariant {
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

	function formatCount(value: number): string {
		return value.toLocaleString();
	}

	function formatItemCount(count: number, singular: string, plural: string): string {
		return `${formatCount(count)} ${count === 1 ? singular : plural}`;
	}

	function getSelectorLabel(selectorId: string): string {
		return selectors.find((selector) => selector.id === selectorId)?.label ?? selectorId;
	}

	function getEligibleLaterCount(result: PreviewResult): number {
		return Math.max(0, result.selectableCount - result.selectedCount);
	}

	function getDoesNotMatchCount(result: PreviewResult): number {
		return Math.max(0, result.totalItems - result.matchedCount);
	}

	onDestroy(() => {
		clearStepTimer();
	});
</script>

<Modal
	{open}
	header={filter ? `Preview: ${filter.name}` : 'Preview Filter'}
	size="2xl"
	height="xl"
	on:cancel={closePreview}
>
	<svelte:fragment slot="body">
		{#if loading}
			<div class="space-y-4">
				<div class="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
					<Loader2 size={16} class="animate-spin text-blue-600 dark:text-blue-400" />
					<span>{loadingText}</span>
				</div>
				<div
					class="overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700/60"
				>
					{#each skeletonRows as _}
						<div
							class="flex gap-4 border-b border-neutral-200 p-4 last:border-0 dark:border-neutral-800"
						>
							<div class="h-4 w-2/5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
							<div class="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
							<div class="h-4 w-28 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
							<div class="h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"></div>
						</div>
					{/each}
				</div>
			</div>
		{:else if error}
			<div
				class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
			>
				{error}
			</div>
		{:else if data}
			<div class="space-y-4">
				<div
					class="space-y-3 rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700/60 dark:bg-neutral-900"
				>
					<div class="flex">
						<span class="w-24 shrink-0 text-sm font-medium text-neutral-500 dark:text-neutral-400">
							Library
						</span>
						<span class="text-sm text-neutral-900 dark:text-neutral-100">
							{formatItemCount(data.totalItems, 'item', 'items')} checked
						</span>
					</div>

					<div class="flex">
						<span class="w-24 shrink-0 text-sm font-medium text-neutral-500 dark:text-neutral-400">
							Filter
						</span>
						<span class="text-sm text-neutral-900 dark:text-neutral-100">
							"{data.filterName}"
							<span class="mx-1 text-neutral-400">&rarr;</span>
							<span class="font-mono font-medium">{formatCount(data.matchedCount)}</span>
							matched
							<span class="mx-1 text-neutral-400">&rarr;</span>
							<span class="font-mono font-medium">{formatCount(data.selectableCount)}</span>
							after cooldown
						</span>
					</div>

					<div class="flex">
						<span class="w-24 shrink-0 text-sm font-medium text-neutral-500 dark:text-neutral-400">
							Selection
						</span>
						<span class="text-sm text-neutral-900 dark:text-neutral-100">
							{getSelectorLabel(data.selector)}
							<span class="font-mono font-medium">{formatCount(data.selectedCount)}</span>
							of <span class="font-mono">{formatCount(data.requestedCount)}</span>
							will search next
							{#if getEligibleLaterCount(data) > 0}
								<span class="mx-1 text-neutral-400">&rarr;</span>
								{formatItemCount(getEligibleLaterCount(data), 'item', 'items')}
								eligible later
							{/if}
						</span>
					</div>

					<div class="flex">
						<span class="w-24 shrink-0 text-sm font-medium text-neutral-500 dark:text-neutral-400">
							Cooldown
						</span>
						<span class="text-sm text-neutral-900 dark:text-neutral-100">
							{formatItemCount(data.cooldownCount, 'item', 'items')} already searched,
							{formatItemCount(getDoesNotMatchCount(data), 'item does', 'items do')}
							not match
						</span>
					</div>
				</div>

				<ActionsBar className="md:justify-start">
					<SearchAction {searchStore} placeholder="Search items..." responsive />
					<ActionButton icon={CircleDot} hasDropdown square title="Filter by status">
						<svelte:fragment slot="dropdown">
							<Dropdown position="right" mobilePosition="middle" minWidth="12rem">
								<DropdownHeader label="Status" />
								<DropdownItem
									label="All statuses"
									selected={statusFilters.size === 0}
									on:click={clearStatusFilters}
								/>
								{#each statusOptions as option}
									<DropdownItem
										label={option.label}
										selected={statusFilters.has(option.value)}
										on:click={() => toggleStatus(option.value)}
									/>
								{/each}
							</Dropdown>
						</svelte:fragment>
					</ActionButton>
				</ActionsBar>

				<ExpandableTable
					{columns}
					data={filteredItems}
					getRowId={(row) => row.id}
					bind:expandedRows={expandedIds}
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
							<Label variant={statusMeta[row.status].variant} size="sm" rounded="md">
								{statusMeta[row.status].label}
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
								<div
									class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center"
								>
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

								<div
									class="grid grid-cols-1 gap-2 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center"
								>
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

								<div
									class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center"
								>
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										Profile
									</div>
									<div class="min-w-0 text-sm break-words text-neutral-900 dark:text-neutral-100">
										{row.details.qualityProfile}
									</div>
								</div>

								<div
									class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center"
								>
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										Score
									</div>
									<div class="font-mono text-sm text-neutral-900 dark:text-neutral-100">
										{formatScore(row.details.score)}
									</div>
								</div>

								<div
									class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center"
								>
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

								<div
									class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center"
								>
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										Status
									</div>
									<div>
										<Label variant={statusVariant(row.details.status)} size="sm" rounded="md">
											{formatStatus(row.details.status)}
										</Label>
									</div>
								</div>

								<div
									class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center"
								>
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">Size</div>
									<div class="font-mono text-sm text-neutral-900 dark:text-neutral-100">
										{formatSize(row.details.sizeOnDisk)}
									</div>
								</div>

								<div
									class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center"
								>
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										Added
									</div>
									<div class="font-mono text-sm text-neutral-900 dark:text-neutral-100">
										{formatDateValue(row.details.dateAdded)}
									</div>
								</div>

								<div
									class="grid grid-cols-1 gap-1 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center"
								>
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
										Release Group
									</div>
									<div
										class="min-w-0 font-mono text-sm break-words text-neutral-900 dark:text-neutral-100"
									>
										{row.details.releaseGroup || 'None'}
									</div>
								</div>

								<div
									class="grid grid-cols-1 gap-2 py-3 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center"
								>
									<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">Tags</div>
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
