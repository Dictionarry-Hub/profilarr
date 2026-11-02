<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import Copy from '@lucide/svelte/icons/copy';
	import { enhance } from '$app/forms';
	import { alertStore } from '#client/alerts/store.ts';
	import Modal from '#ui/modal/Modal.svelte';
	import CodeBlock from '#ui/code/CodeBlock.svelte';
	import Table from '#ui/table/Table.svelte';
	import Button from '#ui/button/Button.svelte';
	import NumberInput from '#ui/form/NumberInput.svelte';
	import Pagination from '#ui/navigation/pagination/Pagination.svelte';
	import PageMeta from '#ui/meta/PageMeta.svelte';
	import Tooltip from '#ui/tooltip/Tooltip.svelte';
	import LogLevelCell from '#ui/table/LogLevelCell.svelte';
	import LogSourceCell from '#ui/table/LogSourceCell.svelte';
	import type { Column, SortDirection, SortState } from '#ui/table/types.ts';
	import LogsActionsBar from './components/LogsActionsBar.svelte';
	import { getPersistentSearchStore } from '#stores/search.ts';
	import { createCardRowsStore } from '#stores/dataPage.ts';
	import { formatDateTime } from '#shared/utils/dates.ts';
	import { dateFormat } from '#stores/dateFormat.ts';
	import { serverTimezone } from '#stores/timezone.ts';
	import { copyToClipboard } from '#client/utils/clipboard.ts';
	import { refreshAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { onMount, type Component } from 'svelte';

	export let data: PageData;

	const REJECTED_FILE_MESSAGES = [
		"Nice try. That's not a log file, so here's the latest log instead.",
		"That file isn't a log. Logs are all this page will show you.",
		'🕵️ Not a log. Showing the latest log instead.'
	];

	// A ?file= outside the logs list was refused, and the newest log shows instead
	onMount(() => {
		if (!data.rejectedFile) return;
		const message =
			REJECTED_FILE_MESSAGES[Math.floor(Math.random() * REJECTED_FILE_MESSAGES.length)];
		alertStore.add('warning', message);
	});

	interface LogEntry {
		timestamp: string;
		level: string;
		message: string;
		source?: string;
		meta?: unknown;
	}

	const levelCellComponent = LogLevelCell as unknown as Component;
	const sourceCellComponent = LogSourceCell as unknown as Component;

	// Initialize search store
	const searchStore = getPersistentSearchStore('settingsLogsSearch', { debounceMs: 300 });

	// Filter state. The shown levels are saved per browser; DEBUG starts hidden.
	const LOG_LEVELS = [
		{ key: 'DEBUG', defaultVisible: false },
		{ key: 'INFO', defaultVisible: true },
		{ key: 'WARN', defaultVisible: true },
		{ key: 'ERROR', defaultVisible: true }
	];
	const levelsStore = createCardRowsStore('settingsLogsLevels', LOG_LEVELS);
	let selectedSources: Set<string> = new Set();
	let isRefreshing = false;
	let cleanupFormRef: HTMLFormElement | null = null;

	// Pagination state
	let currentPage = 1;
	let itemsPerPage = 100;
	let sortState: SortState | null = { key: 'timestamp', direction: 'desc' };

	// Live view: while the newest file is open, new entries stream in from
	// /settings/logs/events and join the table, dropping the oldest at the cap.
	const LIVE_CAP = 5_000;
	const LIVE_RETRY_MS = 3_000;
	// New rows wait in a queue and leave it at a steady pace: one per tick, two
	// while a backlog builds. A queue that falls too far behind joins at once.
	const TRICKLE_MS = 50;
	const TRICKLE_BACKLOG = 20;
	const TRICKLE_MAX_LAG_MS = 10_000;

	let liveLogs: LogEntry[] = [];
	let incomingLogs: { log: LogEntry; queuedAt: number }[] = [];
	let liveConnected = false;
	let eventSource: EventSource | null = null;
	let trickleTimer: ReturnType<typeof setInterval> | null = null;
	let retryTimer: ReturnType<typeof setTimeout> | null = null;

	// No file yet (file logging off) also counts as the newest log
	const liveAvailable = !data.selectedFile || data.selectedFile === data.logFiles[0]?.filename;

	// A refresh reloads the file, which already holds the earlier live entries
	let loadedLogs = data.logs;
	$: if (data.logs !== loadedLogs) {
		loadedLogs = data.logs;
		dropLoadedLiveLogs();
	}

	function dropLoadedLiveLogs() {
		let newest = '';
		for (const log of loadedLogs) {
			if (log.timestamp > newest) newest = log.timestamp;
		}
		liveLogs = liveLogs.filter((log) => log.timestamp > newest);
		incomingLogs = incomingLogs.filter((item) => item.log.timestamp > newest);
	}

	function trickle() {
		if (incomingLogs.length === 0) {
			stopTrickle();
			return;
		}
		const behind = Date.now() - incomingLogs[0].queuedAt > TRICKLE_MAX_LAG_MS;
		const count = behind ? incomingLogs.length : incomingLogs.length > TRICKLE_BACKLOG ? 2 : 1;
		const joined = incomingLogs.splice(0, count).map((item) => item.log);
		liveLogs = [...liveLogs, ...joined].slice(-LIVE_CAP);
	}

	function stopTrickle() {
		if (trickleTimer) clearInterval(trickleTimer);
		trickleTimer = null;
	}

	function connectLive() {
		retryTimer = null;
		eventSource = new EventSource('/settings/logs/events');
		eventSource.onopen = () => {
			liveConnected = true;
		};
		eventSource.addEventListener('log', (event) => {
			try {
				const log = JSON.parse((event as MessageEvent<string>).data) as LogEntry;
				incomingLogs.push({ log, queuedAt: Date.now() });
			} catch {
				return;
			}
			trickleTimer ??= setInterval(trickle, TRICKLE_MS);
		});
		eventSource.onerror = () => {
			liveConnected = false;
			// The browser retries on its own unless it gave up, e.g. after a redirect
			if (eventSource?.readyState === EventSource.CLOSED) {
				eventSource = null;
				retryTimer = setTimeout(connectLive, LIVE_RETRY_MS);
			}
		};
	}

	function disconnectLive() {
		eventSource?.close();
		eventSource = null;
		stopTrickle();
		if (retryTimer) clearTimeout(retryTimer);
	}

	onMount(() => {
		if (liveAvailable) connectLive();
		return disconnectLive;
	});

	$: liveTooltip = !liveAvailable
		? ''
		: liveConnected
			? 'Live: new logs appear as they are written.'
			: 'Disconnected. Reconnecting...';

	$: allLogs = liveLogs.length > 0 ? [...data.logs, ...liveLogs] : data.logs;

	// Extract unique sources from logs (excluding 'ALL' since empty set means all)
	$: uniqueSources = [...new Set(allLogs.map((log) => log.source).filter(Boolean))] as string[];

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
				html: `<span class="font-mono text-xs text-neutral-600 dark:text-neutral-400">${formatDateTime(row.timestamp, $serverTimezone, $dateFormat)}</span>`
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
			cell: () => sourceCellComponent
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
		await refreshAll();
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

		const copied = await copyToClipboard(logText);
		if (copied) {
			alertStore.add('success', 'Log entry copied to clipboard');
		} else {
			alertStore.add('error', 'Failed to copy to clipboard');
		}
	}

	// Reactive filtering
	$: filteredLogs = allLogs.filter((log) => {
		// Level filter
		if (!$levelsStore.includes(log.level)) {
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
	$: if ($levelsStore || selectedSources || $searchStore.query) {
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

	function handlePageChange(page: number) {
		currentPage = page;
	}

	function handleSortChange(nextSort: SortState | null) {
		sortState = nextSort;
		currentPage = 1;
	}
</script>

<PageMeta title="Logs" />

<div class="p-4 md:p-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-neutral-900 md:text-3xl dark:text-neutral-50">Logs</h1>
		<p class="mt-3 text-base text-neutral-600 md:text-lg dark:text-neutral-400">
			Application logs with filtering and search
		</p>
	</div>

	<!-- Actions Bar -->
	<div data-onboarding="logs-actions">
		<LogsActionsBar
			{searchStore}
			logFiles={data.logFiles}
			selectedFile={data.selectedFile}
			logLevels={LOG_LEVELS.map((level) => level.key)}
			selectedLevels={$levelsStore}
			{selectedSources}
			{uniqueSources}
			{isRefreshing}
			onChangeFile={changeLogFile}
			onToggleLevel={(level) => levelsStore.toggle(level)}
			onToggleSource={toggleSource}
			onRefresh={refreshLogs}
			onDownload={downloadLogs}
			onCleanup={triggerCleanupLogs}
		/>
	</div>

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
		<!-- Empty tooltip text, as for an older log file, disables the tooltip -->
		<Tooltip text={liveTooltip} position="top" align="left">
			<span class="flex items-center gap-2">
				{#if liveAvailable}
					<span
						class="h-2 w-2 shrink-0 rounded-full"
						class:animate-pulse={liveConnected}
						class:bg-green-500={liveConnected}
						class:bg-red-500={!liveConnected}
					></span>
				{/if}
				<span>
					Showing {startIndex + 1}-{endIndex} of {filteredLogs.length} logs
					{#if filteredLogs.length !== allLogs.length}
						(filtered from {allLogs.length})
					{/if}
				</span>
			</span>
		</Tooltip>

		<!-- Pagination -->
		{#if totalPages > 1}
			<Pagination {currentPage} {totalPages} onPageChange={handlePageChange} />
		{/if}
	</div>

	<!-- Log Table -->
	<div data-onboarding="logs-table">
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
	</div>

	<!-- Bottom Pagination -->
	{#if totalPages > 1}
		<div class="mt-4 flex justify-center">
			<Pagination {currentPage} {totalPages} onPageChange={handlePageChange} />
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
