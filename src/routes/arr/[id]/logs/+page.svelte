<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Copy, RefreshCw, Filter, ChevronLeft, ChevronRight, Rows3 } from 'lucide-svelte';
	import { alertStore } from '$alerts/store';
	import Table from '$ui/table/Table.svelte';
	import Button from '$ui/button/Button.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import type { Column } from '$ui/table/types';
	import { getPersistentSearchStore, type SearchStore } from '$lib/client/stores/search';
	import type { PageData } from './$types';

	export let data: PageData;

	interface LogEntry {
		id: number;
		time: string;
		level: string;
		logger: string;
		message: string;
		exception?: string | null;
	}

	// Initialize search store
	let searchStore: SearchStore;
	$: searchStore = getPersistentSearchStore(`arrLogsSearch:${$page.params.id}`, {
		debounceMs: 300
	});

	// Filter state
	let selectedLevel: string = data.filters.level || 'ALL';
	let pageSize: number = data.filters.pageSize;
	let isRefreshing = false;

	const logLevels = ['ALL', 'Trace', 'Debug', 'Info', 'Warn', 'Error', 'Fatal'] as const;

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
			header: 'Time',
			width: '180px',
			cell: (row) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — arr API data, not user content
				html: `<span class="font-mono text-xs text-neutral-600 dark:text-neutral-400">${new Date(row.time).toLocaleString()}</span>`
			})
		},
		{
			key: 'level',
			header: 'Level',
			width: '80px',
			cell: (row) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — arr API data, not user content
				html: `<span class="font-semibold ${levelColors[row.level] || 'text-neutral-600 dark:text-neutral-400'}">${row.level}</span>`
			})
		},
		{
			key: 'logger',
			header: 'Logger',
			width: '200px',
			cell: (row) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — arr API data, not user content
				html: `<span class="font-mono text-xs text-neutral-500 dark:text-neutral-500">${row.logger}</span>`
			})
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

		try {
			await navigator.clipboard.writeText(logText);
			alertStore.add('success', 'Log entry copied to clipboard');
		} catch {
			alertStore.add('error', 'Failed to copy to clipboard');
		}
	}

	// Navigate with updated params
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
	async function refreshLogs() {
		isRefreshing = true;
		await goto($page.url.toString(), { invalidateAll: true });
		isRefreshing = false;
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
	$: filteredLogs = data.logs.records.filter((log) => {
		const query = $searchStore.query;
		if (!query) return true;

		const searchLower = query.toLowerCase();
		return (
			log.message.toLowerCase().includes(searchLower) ||
			log.logger.toLowerCase().includes(searchLower)
		);
	});

	// Pagination info
	$: totalPages = Math.ceil(data.logs.totalRecords / data.logs.pageSize);
	$: currentPage = data.logs.page;
</script>

<svelte:head>
	<title>{data.instance.name} - Logs - Profilarr</title>
</svelte:head>

<div class="mt-6">
	<!-- Actions Bar -->
	<ActionsBar className="justify-end">
		<SearchAction {searchStore} placeholder="Search logs..." />

		<!-- Level Filter -->
		<ActionButton icon={Filter} hasDropdown={true} dropdownPosition="right">
			<svelte:fragment slot="dropdown" let:dropdownPosition>
				<Dropdown position={dropdownPosition} minWidth="8rem">
					{#each logLevels as level}
						<button
							type="button"
							on:click={() => changeLevel(level)}
							class="flex w-full items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2 text-left transition-colors first:rounded-t-lg last:rounded-b-lg last:border-b-0 dark:border-neutral-700
								{selectedLevel === level
								? 'bg-neutral-100 dark:bg-neutral-700'
								: 'hover:bg-neutral-100 dark:hover:bg-neutral-700'}"
						>
							<span
								class="font-medium {level === 'ALL'
									? 'text-neutral-600 dark:text-neutral-400'
									: levelColors[level]}">{level}</span
							>
						</button>
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

		<!-- Refresh -->
		<ActionButton hasDropdown={true} dropdownPosition="right" on:click={refreshLogs}>
			<RefreshCw
				size={20}
				class="text-neutral-700 dark:text-neutral-300 {isRefreshing ? 'animate-spin' : ''}"
			/>
			<svelte:fragment slot="dropdown" let:dropdownPosition>
				<Dropdown position={dropdownPosition} minWidth="6rem">
					<div class="px-3 py-2 text-sm text-neutral-600 dark:text-neutral-400">Refresh logs</div>
				</Dropdown>
			</svelte:fragment>
		</ActionButton>
	</ActionsBar>

	<!-- Stats -->
	<div
		class="mt-6 mb-4 flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400"
	>
		<span>
			Showing {filteredLogs.length} of {data.logs.totalRecords} logs
			{#if selectedLevel !== 'ALL'}
				(filtered by {selectedLevel})
			{/if}
		</span>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center gap-2">
				<button
					type="button"
					disabled={currentPage <= 1}
					on:click={() => goToPage(currentPage - 1)}
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
					on:click={() => goToPage(currentPage + 1)}
					class="rounded p-1 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-700"
				>
					<ChevronRight size={20} />
				</button>
			</div>
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
		<div
			class="mt-4 flex items-center justify-center gap-2 text-sm text-neutral-600 dark:text-neutral-400"
		>
			<button
				type="button"
				disabled={currentPage <= 1}
				on:click={() => goToPage(currentPage - 1)}
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
				on:click={() => goToPage(currentPage + 1)}
				class="rounded p-1 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-700"
			>
				<ChevronRight size={20} />
			</button>
		</div>
	{/if}
</div>
