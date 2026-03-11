<script lang="ts">
	import { Eye, Copy, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { alertStore } from '$alerts/store';
	import Modal from '$ui/modal/Modal.svelte';
	import CodeBlock from '$ui/code/CodeBlock.svelte';
	import Table from '$ui/table/Table.svelte';
	import Button from '$ui/button/Button.svelte';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import type { Column, SortDirection, SortState } from '$ui/table/types';
	import LogsActionsBar from './components/LogsActionsBar.svelte';
	import LogLevelLabelCell from './components/LogLevelLabelCell.svelte';
	import { getPersistentSearchStore } from '$lib/client/stores/search';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import type { ComponentType } from 'svelte';

	export let data: PageData;

	interface LogEntry {
		timestamp: string;
		level: string;
		message: string;
		source?: string;
		meta?: unknown;
	}

	const levelCellComponent = LogLevelLabelCell as unknown as ComponentType;

	// Initialize search store
	const searchStore = getPersistentSearchStore('settingsLogsSearch', { debounceMs: 300 });

	// Filter state
	let selectedLevel: 'ALL' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' = 'ALL';
	let selectedSources: Set<string> = new Set();
	let isRefreshing = false;
	let cleanupFormRef: HTMLFormElement | null = null;

	// Pagination state
	let currentPage = 1;
	let itemsPerPage = 100;
	let sortState: SortState | null = { key: 'timestamp', direction: 'desc' };

	// Extract unique sources from logs (excluding 'ALL' since empty set means all)
	$: uniqueSources = [...new Set(data.logs.map((log) => log.source).filter(Boolean))] as string[];

	function toggleSource(source: string) {
		selectedSources = new Set(selectedSources);
		if (selectedSources.has(source)) {
			selectedSources.delete(source);
		} else {
			selectedSources.add(source);
		}
	}

	// Table columns
	const columns: Column<LogEntry>[] = [
		{
			key: 'timestamp',
			header: 'Timestamp',
			sortable: true,
			sortAccessor: (row) => new Date(row.timestamp).getTime(),
			cell: (row) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — date formatting, not user content
				html: `<span class="font-mono text-xs text-neutral-600 dark:text-neutral-400">${new Date(row.timestamp).toLocaleString()}</span>`
			})
		},
		{
			key: 'level',
			header: 'Level',
			sortable: true,
			cell: () => levelCellComponent
		},
		{
			key: 'source',
			header: 'Source',
			sortable: true,
			cell: (row) => row.source || '-'
		},
		{
			key: 'message',
			header: 'Message',
			cell: (row) => row.message
		}
	];

	// Meta modal state
	let showMetaModal = false;
	let selectedMeta: unknown = null;

	function viewMeta(meta: unknown) {
		selectedMeta = meta;
		showMetaModal = true;
	}

	function closeMetaModal() {
		showMetaModal = false;
		selectedMeta = null;
	}

	// Download logs as JSON
	function downloadLogs() {
		const dataStr = JSON.stringify(filteredLogs, null, 2);
		const dataBlob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(dataBlob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `profilarr-logs-${new Date().toISOString()}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	function handleCleanupResult(result: { type: string; data?: unknown }) {
		if (result.type === 'failure' && result.data) {
			alertStore.add(
				'error',
				(result.data as { error?: string }).error || 'Failed to run logs cleanup'
			);
		} else if (result.type === 'success') {
			alertStore.add('success', 'Logs cleanup queued');
		}
	}

	function triggerCleanupLogs() {
		cleanupFormRef?.requestSubmit();
	}

	// Refresh logs by refetching data
	async function refreshLogs() {
		isRefreshing = true;
		await invalidateAll();
		isRefreshing = false;
	}

	// Change log file
	function changeLogFile(filename: string) {
		const url = new URL(window.location.href);
		url.searchParams.set('file', filename);
		window.location.href = url.toString();
	}

	// Copy log entry to clipboard
	async function copyLog(log: LogEntry) {
		const logText = `[${log.timestamp}] ${log.level} - ${log.message}${log.source ? ` [${log.source}]` : ''}${log.meta ? `\nMeta: ${JSON.stringify(log.meta, null, 2)}` : ''}`;

		try {
			await navigator.clipboard.writeText(logText);
			alertStore.add('success', 'Log entry copied to clipboard');
		} catch {
			// Fallback for non-secure contexts (HTTP + non-localhost)
			const textArea = document.createElement('textarea');
			textArea.value = logText;
			textArea.style.position = 'fixed';
			textArea.style.left = '-9999px';
			document.body.appendChild(textArea);
			textArea.select();
			try {
				document.execCommand('copy');
				alertStore.add('success', 'Log entry copied to clipboard');
			} catch {
				alertStore.add('error', 'Failed to copy to clipboard');
			}
			document.body.removeChild(textArea);
		}
	}

	// Reactive filtering
	$: filteredLogs = data.logs.filter((log) => {
		// Level filter
		if (selectedLevel !== 'ALL' && log.level !== selectedLevel) {
			return false;
		}

		// Source filter (empty set means show all)
		if (selectedSources.size > 0 && !selectedSources.has(log.source || '')) {
			return false;
		}

		// Search filter
		const query = $searchStore.query;
		if (query) {
			const searchLower = query.toLowerCase();
			const matchMessage = log.message.toLowerCase().includes(searchLower);
			const matchSource = log.source?.toLowerCase().includes(searchLower);
			return matchMessage || matchSource;
		}

		return true;
	});

	function getCellValue(row: LogEntry, key: string): unknown {
		return key
			.split('.')
			.reduce<unknown>(
				(obj, k) => (obj as Record<string, unknown> | undefined)?.[k],
				row as unknown
			);
	}

	function compareValues(a: unknown, b: unknown): number {
		if (a == null && b == null) return 0;
		if (a == null) return -1;
		if (b == null) return 1;

		if (typeof a === 'number' && typeof b === 'number') {
			return a - b;
		}

		if (a instanceof Date && b instanceof Date) {
			return a.getTime() - b.getTime();
		}

		return String(a).localeCompare(String(b));
	}

	function getSortValue(row: LogEntry, column: Column<LogEntry>) {
		if (column.sortAccessor) {
			return column.sortAccessor(row);
		}
		return getCellValue(row, column.key);
	}

	function sortLogs(
		rows: LogEntry[],
		state: SortState | null,
		fallbackDirection: SortDirection
	): LogEntry[] {
		const baseSorted = [...rows].sort(
			(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
		);

		if (!state) {
			return baseSorted;
		}

		if (state.key === 'timestamp' && state.direction === fallbackDirection) {
			return baseSorted;
		}

		const column = columns.find((col) => col.key === state.key);
		if (!column) {
			return baseSorted;
		}

		const sorted = [...rows].sort((a, b) => {
			if (column.sortComparator) {
				return column.sortComparator(a, b);
			}

			const aValue = getSortValue(a, column);
			const bValue = getSortValue(b, column);
			return compareValues(aValue, bValue);
		});

		return state.direction === 'desc' ? sorted.reverse() : sorted;
	}

	const defaultSortDirection: SortDirection = 'desc';

	// Sorted ordering for pagination and display
	$: sortedLogs = sortLogs(filteredLogs, sortState, defaultSortDirection);

	// Reset to page 1 when filters change
	$: if (selectedLevel || selectedSources || $searchStore.query) {
		currentPage = 1;
	}

	// Pagination computed values
	$: totalPages = Math.max(1, Math.ceil(sortedLogs.length / itemsPerPage));
	$: startIndex = (currentPage - 1) * itemsPerPage;
	$: endIndex = Math.min(startIndex + itemsPerPage, sortedLogs.length);
	$: paginatedLogs = sortedLogs.slice(startIndex, endIndex);

	// Ensure currentPage stays within bounds when itemsPerPage changes
	$: if (currentPage > totalPages) {
		currentPage = totalPages;
	}

	function goToPreviousPage() {
		if (currentPage > 1) {
			currentPage--;
		}
	}

	function goToNextPage() {
		if (currentPage < totalPages) {
			currentPage++;
		}
	}

	function handleSortChange(nextSort: SortState | null) {
		sortState = nextSort;
		currentPage = 1;
	}
</script>

<div class="p-4 md:p-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-neutral-900 md:text-3xl dark:text-neutral-50">Logs</h1>
		<p class="mt-3 text-base text-neutral-600 md:text-lg dark:text-neutral-400">
			Application logs with filtering and search
		</p>
	</div>

	<!-- Actions Bar -->
	<LogsActionsBar
		{searchStore}
		logFiles={data.logFiles}
		selectedFile={data.selectedFile}
		{selectedLevel}
		{selectedSources}
		{uniqueSources}
		{isRefreshing}
		onChangeFile={changeLogFile}
		onChangeLevel={(level) => (selectedLevel = level)}
		onToggleSource={toggleSource}
		onRefresh={refreshLogs}
		onDownload={downloadLogs}
		onCleanup={triggerCleanupLogs}
	/>

	<form
		bind:this={cleanupFormRef}
		method="POST"
		action="?/cleanupLogs"
		class="hidden"
		use:enhance={() => {
			return async ({ result, update }) => {
				handleCleanupResult(result);
				await update();
			};
		}}
	></form>

	<!-- Stats -->
	<div
		class="mt-6 mb-4 flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400"
	>
		<span>
			Showing {startIndex + 1}-{endIndex} of {filteredLogs.length} logs
			{#if filteredLogs.length !== data.logs.length}
				(filtered from {data.logs.length})
			{/if}
		</span>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center gap-2">
				<button
					type="button"
					disabled={currentPage <= 1}
					on:click={goToPreviousPage}
					class="rounded p-1 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-700"
				>
					<ChevronLeft size={20} />
				</button>
				<span class="text-sm">
					Page {currentPage} of {totalPages}
				</span>
				<button
					type="button"
					disabled={currentPage >= totalPages}
					on:click={goToNextPage}
					class="rounded p-1 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-700"
				>
					<ChevronRight size={20} />
				</button>
			</div>
		{/if}
	</div>

	<!-- Log Table -->
	<Table
		data={paginatedLogs}
		{columns}
		emptyMessage="No logs found"
		hoverable={true}
		compact={true}
		responsive
		initialSort={{ key: 'timestamp', direction: defaultSortDirection }}
		onSortChange={handleSortChange}
	>
		<svelte:fragment slot="actions" let:row>
			<div class="flex items-center justify-end gap-1">
				<Button
					icon={Copy}
					size="xs"
					variant="secondary"
					title="Copy log entry"
					ariaLabel="Copy log entry"
					on:click={() => copyLog(row)}
				/>
				{#if row.meta}
					<Button
						icon={Eye}
						size="xs"
						variant="secondary"
						title="View metadata"
						ariaLabel="View metadata"
						on:click={() => viewMeta(row.meta)}
					/>
				{/if}
			</div>
		</svelte:fragment>
	</Table>

	<!-- Bottom Pagination -->
	{#if totalPages > 1}
		<div
			class="mt-4 flex items-center justify-center gap-2 text-sm text-neutral-600 dark:text-neutral-400"
		>
			<button
				type="button"
				disabled={currentPage <= 1}
				on:click={goToPreviousPage}
				class="rounded p-1 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-700"
			>
				<ChevronLeft size={20} />
			</button>
			<span class="text-sm">
				Page {currentPage} of {totalPages}
			</span>
			<button
				type="button"
				disabled={currentPage >= totalPages}
				on:click={goToNextPage}
				class="rounded p-1 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-700"
			>
				<ChevronRight size={20} />
			</button>
		</div>
	{/if}
</div>

<!-- Meta Modal -->
<Modal
	open={showMetaModal}
	header="Log Metadata"
	bodyMessage=""
	confirmText="Close"
	cancelText="Close"
	size="2xl"
	on:confirm={closeMetaModal}
	on:cancel={closeMetaModal}
>
	<div slot="body" class="space-y-3">
		<CodeBlock code={JSON.stringify(selectedMeta, null, 2)} language="json" />
	</div>
</Modal>
