<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { Copy, RefreshCw, Filter, Rows3, Loader2, AlertTriangle } from '@lucide/svelte';
	import { alertStore } from '$alerts/store';
	import Table from '$ui/table/Table.svelte';
	import Button from '$ui/button/Button.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import Pagination from '$ui/navigation/pagination/Pagination.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import LogLevelCell from '$ui/table/LogLevelCell.svelte';
	import LogSourceCell from '$ui/table/LogSourceCell.svelte';
	import type { Column } from '$ui/table/types';
	import { getPersistentSearchStore, type SearchStore } from '$lib/client/stores/search';
	import { formatDateTime } from '$shared/utils/dates.ts';
	import { dateFormat } from '$lib/client/stores/dateFormat.ts';
	import { serverTimezone } from '$lib/client/stores/timezone.ts';
	import { copyToClipboard } from '$lib/client/utils/clipboard';
	import type { PageData } from './$types';
	import type { Component } from 'svelte';

	export let data: PageData;

	interface LogEntry {
		id: number;
		time: string;
		level: string;
		logger: string;
		message: string;
		exception?: string | null;
	}

	interface LogResponse {
		page: number;
		pageSize: number;
		totalRecords: number;
		records: LogEntry[];
	}

	const levelCellComponent = LogLevelCell as unknown as Component;
	const sourceCellComponent = LogSourceCell as unknown as Component;

	// Client-side log fetching — avoids blocking tab navigation with a
	// server-streamed promise. The page load returns instantly; logs are
	// fetched separately via the colocated +server.ts endpoint.
	let logs: LogResponse | null = null;
	let logsLoading = true;
	let logsError: string | null = null;
	let fetchController: AbortController | null = null;

	function buildLogsUrl(filters: { page: number; pageSize: number; level?: string }): string {
		const params = new URLSearchParams();
		params.set('page', String(filters.page));
		params.set('pageSize', String(filters.pageSize));
		if (filters.level) params.set('level', filters.level);
		return resolve(`/arr/${$page.params.id}/logs?${params}`);
	}

	async function fetchLogs(filters: { page: number; pageSize: number; level?: string }) {
		// Abort any in-flight request
		fetchController?.abort();
		fetchController = new AbortController();
		const { signal } = fetchController;

		logs = null;
		logsLoading = true;
		logsError = null;

		try {
			const res = await fetch(buildLogsUrl(filters), {
				signal,
				headers: { Accept: 'application/json' }
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(body?.message || `HTTP ${res.status}`);
			}
			logs = await res.json();
		} catch (err) {
			if ((err as Error).name === 'AbortError') return;
			logsError = err instanceof Error ? err.message : String(err);
		} finally {
			logsLoading = false;
		}
	}

	// Fetch logs on mount and whenever filters change via navigation
	$: if (browser) {
		fetchLogs(data.filters);
	}

	// Initialize search store
	let searchStore: SearchStore;
	$: searchStore = getPersistentSearchStore(`arrLogsSearch:${$page.params.id}`, {
		debounceMs: 300
	});

	// Filter state
	let selectedLevel: string = data.filters.level || 'ALL';
	let pageSize: number = data.filters.pageSize;

	const logLevels = ['ALL', 'Fatal', 'Error', 'Warn', 'Info', 'Debug', 'Trace'] as const;

	// Level colors matching arr log levels
	const levelColors: Record<string, string> = {
		Trace: 'text-neutral-500 dark:text-neutral-500',
		Debug: 'text-cyan-600 dark:text-cyan-400',
		Info: 'text-green-600 dark:text-green-400',
		Warn: 'text-yellow-600 dark:text-yellow-400',
		Error: 'text-red-600 dark:text-red-400',
		Fatal: 'text-red-800 dark:text-red-300'
	};

	// Table columns
	const columns: Column<LogEntry>[] = [
		{
			key: 'time',
			header: 'Timestamp',
			width: '180px',
			cell: (row) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — arr API data, not user content
				html: `<span class="font-mono text-xs text-neutral-600 dark:text-neutral-400">${formatDateTime(row.time, $serverTimezone, $dateFormat)}</span>`
			})
		},
		{
			key: 'level',
			header: 'Level',
			width: '80px',
			cell: () => levelCellComponent
		},
		{
			key: 'logger',
			header: 'Source',
			width: '200px',
			cell: () => sourceCellComponent
		},
		{
			key: 'message',
			header: 'Message',
			cell: (row) => row.message
		}
	];

	// Copy log entry to clipboard
	async function copyLog(log: LogEntry) {
		const logText = `[${log.time}] ${log.level} [${log.logger}] ${log.message}${log.exception ? `\nException: ${log.exception}` : ''}`;

		const copied = await copyToClipboard(logText);
		if (copied) {
			alertStore.add('success', 'Log entry copied to clipboard');
		} else {
			alertStore.add('error', 'Failed to copy to clipboard');
		}
	}

	// Navigate with updated params — triggers server load which updates
	// data.filters, which triggers the reactive fetchLogs call above.
	function updateParams(params: Record<string, string | number | undefined>) {
		const url = new URL($page.url);
		for (const [key, value] of Object.entries(params)) {
			if (value === undefined || value === 'ALL') {
				url.searchParams.delete(key);
			} else {
				url.searchParams.set(key, String(value));
			}
		}
		goto(url.toString(), { invalidateAll: true });
	}

	// Refresh logs
	function refreshLogs() {
		fetchLogs(data.filters);
	}

	// Change level filter
	function changeLevel(level: string) {
		selectedLevel = level;
		updateParams({ level: level === 'ALL' ? undefined : level, page: 1 });
	}

	// Change page size
	function changePageSize(newSize: number) {
		pageSize = newSize;
		updateParams({ pageSize: newSize, page: 1 });
	}

	// Pagination
	function goToPage(pageNum: number) {
		updateParams({ page: pageNum });
	}

	// Client-side search filter
	$: filteredLogs = logs
		? logs.records.filter((log) => {
				const query = $searchStore.query;
				if (!query) return true;

				const searchLower = query.toLowerCase();
				return (
					log.message.toLowerCase().includes(searchLower) ||
					log.logger.toLowerCase().includes(searchLower)
				);
			})
		: [];

	// Pagination info
	$: totalPages = logs ? Math.ceil(logs.totalRecords / logs.pageSize) : 0;
	$: currentPage = logs?.page ?? 1;
	$: rangeStart = logs && logs.records.length > 0 ? (logs.page - 1) * logs.pageSize + 1 : 0;
	$: rangeEnd =
		logs && logs.records.length > 0
			? Math.min(rangeStart + logs.records.length - 1, logs.totalRecords)
			: 0;
</script>

<PageMeta title={`${data.instance.name} · Logs`} />

<div class="mt-6">
	<!-- Actions Bar -->
	<ActionsBar className="justify-end">
		<SearchAction {searchStore} placeholder="Search logs..." />

		<!-- Refresh -->
		<Tooltip text="Refresh logs">
			<ActionButton on:click={refreshLogs}>
				<RefreshCw
					size={20}
					class="text-neutral-700 dark:text-neutral-300 {logsLoading ? 'animate-spin' : ''}"
				/>
			</ActionButton>
		</Tooltip>

		<!-- Level Filter -->
		<ActionButton icon={Filter} hasDropdown={true} dropdownPosition="right">
			<svelte:fragment slot="dropdown" let:dropdownPosition>
				<Dropdown position={dropdownPosition} minWidth="8rem">
					<DropdownHeader label="Level and Above" />
					{#each logLevels as level}
						<DropdownItem
							label={level}
							selected={selectedLevel === level}
							checkColor="blue"
							labelClass={`font-mono font-medium ${
								level === 'ALL' ? 'text-neutral-600 dark:text-neutral-400' : levelColors[level]
							}`}
							labelTransform="uppercase"
							on:click={() => changeLevel(level)}
						/>
					{/each}
				</Dropdown>
			</svelte:fragment>
		</ActionButton>

		<!-- Page Size -->
		<ActionButton icon={Rows3} hasDropdown={true} dropdownPosition="right">
			<svelte:fragment slot="dropdown" let:dropdownPosition>
				<Dropdown position={dropdownPosition} minWidth="10rem">
					<div class="p-3">
						<label
							for="pageSize"
							class="mb-2 block text-xs font-medium text-neutral-600 dark:text-neutral-400"
						>
							Rows per page
						</label>
						<NumberInput
							name="pageSize"
							bind:value={pageSize}
							min={10}
							max={1000}
							step={10}
							onchange={changePageSize}
						/>
					</div>
				</Dropdown>
			</svelte:fragment>
		</ActionButton>
	</ActionsBar>

	{#if logsLoading}
		<!-- Loading state -->
		<div
			class="mt-12 flex flex-col items-center justify-center gap-3 text-neutral-500 dark:text-neutral-400"
		>
			<Loader2 size={24} class="animate-spin" />
			<span class="text-sm">Loading logs...</span>
		</div>
	{:else if logsError}
		<!-- Error state -->
		<div
			class="mt-12 flex flex-col items-center justify-center gap-3 text-neutral-500 dark:text-neutral-400"
		>
			<AlertTriangle size={24} class="text-yellow-500 dark:text-yellow-400" />
			<span class="text-sm">Failed to load logs from this instance.</span>
			<span class="text-xs">{logsError}</span>
			<Button variant="secondary" size="sm" on:click={refreshLogs}>Retry</Button>
		</div>
	{:else if logs}
		<!-- Stats -->
		<div
			class="mt-6 mb-4 flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400"
		>
			<span>
				{#if $searchStore.query}
					Showing {filteredLogs.length} matches from logs {rangeStart}–{rangeEnd} of {logs.totalRecords}
				{:else}
					Showing {rangeStart}–{rangeEnd} of {logs.totalRecords} logs
				{/if}
			</span>

			<!-- Pagination -->
			{#if totalPages > 1}
				<Pagination {currentPage} {totalPages} onPageChange={goToPage} />
			{/if}
		</div>

		<!-- Log Table -->
		<Table
			data={filteredLogs}
			{columns}
			emptyMessage="No logs found"
			hoverable={true}
			compact={true}
			responsive
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
				</div>
			</svelte:fragment>
		</Table>

		<!-- Bottom Pagination -->
		{#if totalPages > 1}
			<div class="mt-4 flex justify-center">
				<Pagination {currentPage} {totalPages} onPageChange={goToPage} />
			</div>
		{/if}
	{/if}
</div>
