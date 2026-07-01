<script lang="ts">
	import {
		AlertTriangle,
		X,
		FileText,
		Calendar,
		CircleDot,
		Check,
		FlaskConical,
		Play
	} from 'lucide-svelte';
	import type { RenameJobLog } from '$lib/server/rename/types.ts';
	import {
		createSearchStore,
		getPersistentSearchStore,
		type SearchStore
	} from '$lib/client/stores/search';
	import type { Readable } from 'svelte/store';
	import { page } from '$app/stores';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Pagination from '$ui/navigation/pagination/Pagination.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import Label from '$ui/label/Label.svelte';
	import type { Column } from '$ui/table/types';
	import { formatSmartDateTime } from '$shared/utils/dates';
	import { dateFormat } from '$lib/client/stores/dateFormat';
	import { serverTimezone } from '$lib/client/stores/timezone';

	let searchStore: SearchStore = createSearchStore();
	let debouncedQuery: Readable<string> = searchStore.debouncedQuery;
	$: if ($page?.params?.id) {
		searchStore = getPersistentSearchStore(`renameRunHistorySearch:${$page.params.id}`);
		debouncedQuery = searchStore.debouncedQuery;
	}

	export let runs: RenameJobLog[] = [];

	// Filter state
	let dateFilter: 'all' | 'today' | 'yesterday' | 'week' | 'month' = 'all';
	let statusFilter: 'all' | 'success' | 'partial' | 'failed' | 'skipped' = 'all';

	// Filter runs based on all criteria
	$: filteredRuns = filterRuns(runs, $debouncedQuery, dateFilter, statusFilter);

	function filterRuns(
		items: RenameJobLog[],
		query: string,
		date: typeof dateFilter,
		status: typeof statusFilter
	): RenameJobLog[] {
		let result = items;

		// Text search (search in renamed item titles)
		if (query) {
			const queryLower = query.toLowerCase();
			result = result.filter(
				(item) =>
					item.renamedItems.some((r) => r.title.toLowerCase().includes(queryLower)) ||
					item.status.toLowerCase().includes(queryLower)
			);
		}

		// Date filter
		if (date !== 'all') {
			const now = new Date();
			const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			const yesterday = new Date(today);
			yesterday.setDate(yesterday.getDate() - 1);
			const weekAgo = new Date(today);
			weekAgo.setDate(weekAgo.getDate() - 7);
			const monthAgo = new Date(today);
			monthAgo.setDate(monthAgo.getDate() - 30);

			result = result.filter((item) => {
				const itemDate = new Date(item.startedAt);
				switch (date) {
					case 'today':
						return itemDate >= today;
					case 'yesterday':
						return itemDate >= yesterday && itemDate < today;
					case 'week':
						return itemDate >= weekAgo;
					case 'month':
						return itemDate >= monthAgo;
					default:
						return true;
				}
			});
		}

		// Status filter
		if (status !== 'all') {
			result = result.filter((item) => item.status === status);
		}

		return result;
	}

	// Check if any filters are active
	$: hasActiveFilters = dateFilter !== 'all' || statusFilter !== 'all';

	const pageSize = 20;
	let currentPage = 1;
	$: totalPages = Math.max(1, Math.ceil(filteredRuns.length / pageSize));
	$: if (currentPage > totalPages) currentPage = 1;
	$: paginatedRuns = filteredRuns.slice((currentPage - 1) * pageSize, currentPage * pageSize);

	let expandedIds: Set<string> = new Set();

	const columns: Column<RenameJobLog>[] = [
		{ key: 'runNumber', header: '#', sortable: false },
		{ key: 'date', header: 'Date', sortable: true },
		{ key: 'duration', header: 'Duration', sortable: false },
		{ key: 'status', header: 'Status', sortable: true },
		{ key: 'summary', header: 'Summary', sortable: false }
	];

	// Status label config
	const statusConfig = {
		success: { variant: 'success' as const, icon: Check },
		partial: { variant: 'warning' as const, icon: AlertTriangle },
		failed: { variant: 'danger' as const, icon: X },
		skipped: { variant: 'secondary' as const, icon: X }
	};

	function getRunNumber(row: RenameJobLog): number {
		const originalIndex = runs.findIndex((r) => r.id === row.id);
		return runs.length - originalIndex;
	}

	function formatDuration(startedAt: string, completedAt: string): string {
		const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
	}

	function getFileName(path: string): string {
		return path.split('/').pop() || path;
	}
</script>

<div class="-mx-4 bg-surface-muted px-4 pt-2 pb-6 md:-mx-8 md:px-8">
	<div class="mb-4">
		<ActionsBar>
			<SearchAction {searchStore} placeholder="Search runs..." />

			<!-- Date Filter -->
			<ActionButton icon={Calendar} hasDropdown square title="Filter by date">
				<Dropdown slot="dropdown" position="right" mobilePosition="middle">
					{#each [{ value: 'all', label: 'All time' }, { value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }, { value: 'week', label: 'Last 7 days' }, { value: 'month', label: 'Last 30 days' }] as const as option}
						<DropdownItem
							label={option.label}
							selected={dateFilter === option.value}
							on:click={() => (dateFilter = option.value)}
						/>
					{/each}
				</Dropdown>
			</ActionButton>

			<!-- Status Filter -->
			<ActionButton icon={CircleDot} hasDropdown square title="Filter by status">
				<Dropdown slot="dropdown" position="right" mobilePosition="middle">
					{#each [{ value: 'all', label: 'All' }, { value: 'success', label: 'Success' }, { value: 'partial', label: 'Partial' }, { value: 'failed', label: 'Failed' }, { value: 'skipped', label: 'Skipped' }] as const as option}
						<DropdownItem
							label={option.label}
							selected={statusFilter === option.value}
							on:click={() => (statusFilter = option.value)}
						/>
					{/each}
				</Dropdown>
			</ActionButton>
		</ActionsBar>
	</div>

	<ExpandableTable
		{columns}
		data={paginatedRuns}
		getRowId={(row) => row.id}
		bind:expandedRows={expandedIds}
		chevronPosition="right"
		flushExpanded={true}
		emptyMessage="No rename runs yet. Configure and enable rename to start."
		responsive
	>
		<svelte:fragment slot="cell" let:row let:column>
			{#if column.key === 'runNumber'}
				<span class="font-mono text-text-muted">
					#{getRunNumber(row)}
				</span>
			{:else if column.key === 'date'}
				<div class="flex items-center gap-2">
					<span class="text-text-soft">
						{formatSmartDateTime(row.startedAt, $serverTimezone, $dateFormat)}
					</span>
					{#if row.config.dryRun}
						<Label variant="info" size="sm" radius="md"><FlaskConical size={10} /> Dry Run</Label>
					{:else if row.config.manual}
						<Label variant="success" size="sm" radius="md"><Play size={10} /> Manual</Label>
					{/if}
				</div>
			{:else if column.key === 'duration'}
				<span class="font-mono text-xs text-text-soft">
					{formatDuration(row.startedAt, row.completedAt)}
				</span>
			{:else if column.key === 'status'}
				{@const config = statusConfig[row.status] || statusConfig.failed}
				<Label variant={config.variant} size="sm" radius="md">
					<svelte:component this={config.icon} size={10} />
					{row.status.charAt(0).toUpperCase() + row.status.slice(1)}
				</Label>
			{:else if column.key === 'summary'}
				<span class="text-sm text-text-soft">
					<span class="font-mono">{row.library.totalItems.toLocaleString()}</span> scanned
					<span class="mx-1 text-text">&rarr;</span>
					{#if row.config.dryRun}
						<span class="font-mono">{row.results.filesNeedingRename}</span> would rename
					{:else}
						{#if row.results.filesRenamed > 0}
							<span class="font-mono">{row.results.filesRenamed}</span> file{row.results
								.filesRenamed !== 1
								? 's'
								: ''}
						{/if}
						{#if row.results.foldersRenamed > 0}
							{#if row.results.filesRenamed > 0},
							{/if}
							<span class="font-mono">{row.results.foldersRenamed}</span> folder{row.results
								.foldersRenamed !== 1
								? 's'
								: ''}
						{/if}
						{#if row.results.filesRenamed > 0 || row.results.foldersRenamed > 0}
							renamed
						{:else}
							no changes
						{/if}
					{/if}
				</span>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="expanded" let:row>
			<div class="space-y-3 p-6">
				<!-- Config -->
				<div class="flex">
					<span class="w-24 shrink-0 text-sm font-medium text-text-muted">Config</span>
					<span class="text-sm text-text">
						{#if row.config.renameFolders}Folders enabled{:else}Files only{/if}
						{#if row.config.ignoreTag}
							| Ignore tag: "{row.config.ignoreTag}"
						{/if}
					</span>
				</div>

				<!-- Library -->
				<div class="flex">
					<span class="w-24 shrink-0 text-sm font-medium text-text-muted">Library</span>
					<span class="text-sm text-text">
						<span class="font-mono">{row.library.totalItems.toLocaleString()}</span> items
						<span class="ml-1 font-mono text-xs text-text-muted">
							({row.library.fetchDurationMs}ms)
						</span>
					</span>
				</div>

				<!-- Filtering -->
				{#if row.filtering.skippedByTag > 0}
					<div class="flex">
						<span class="w-24 shrink-0 text-sm font-medium text-text-muted">Filtered</span>
						<span class="text-sm text-text">
							<span class="font-mono">{row.filtering.skippedByTag}</span> skipped by tag
							<span class="mx-1 text-text-subtle">&rarr;</span>
							<span class="font-mono font-medium">{row.filtering.afterIgnoreTag}</span> remaining
						</span>
					</div>
				{/if}

				<!-- Results -->
				<div class="flex">
					<span class="w-24 shrink-0 text-sm font-medium text-text-muted">Results</span>
					<span class="text-sm text-text">
						{#if row.config.dryRun}
							<span class="font-mono">{row.results.filesNeedingRename}</span> files would be renamed
						{:else}
							<span class="font-mono">{row.results.filesRenamed}</span> file{row.results
								.filesRenamed !== 1
								? 's'
								: ''} renamed
							{#if row.results.foldersRenamed > 0}
								, <span class="font-mono">{row.results.foldersRenamed}</span> folder{row.results
									.foldersRenamed !== 1
									? 's'
									: ''} renamed
							{/if}
						{/if}
						{#if row.results.commandsFailed > 0}
							<span class="font-mono text-danger-icon">, {row.results.commandsFailed} failed</span>
						{/if}
					</span>
				</div>

				<!-- Errors -->
				{#if row.results.errors.length > 0}
					<div class="flex">
						<span class="w-24 shrink-0 text-sm font-medium text-danger-icon">Errors</span>
						<div class="space-y-1">
							{#each row.results.errors as error}
								<div class="text-sm text-danger-icon">{error}</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Renamed Items -->
				{#if row.renamedItems.length > 0}
					{@const itemsColumns = [
						{ key: 'title', header: 'Title', sortable: false },
						{ key: 'changes', header: 'Changes', sortable: false, align: 'center' as const }
					]}
					<div class="mt-4 border-t border-border pt-4">
						<div class="mb-3 flex items-center gap-1.5 text-sm font-medium text-text-soft">
							<FileText size={14} />
							Items {row.config.dryRun ? 'Needing Rename' : 'Renamed'}
						</div>
						<ExpandableTable
							columns={itemsColumns}
							data={row.renamedItems}
							getRowId={(item) => item.id}
							compact={true}
							emptyMessage="No items"
							responsive
						>
							<svelte:fragment slot="cell" let:row={item} let:column>
								{#if column.key === 'title'}
									<span class="text-text">{item.title}</span>
								{:else if column.key === 'changes'}
									<div class="flex gap-1">
										{#if item.folder}
											<Badge variant="info" mono>Folder</Badge>
										{/if}
										{#if item.files.length > 0}
											<Badge variant="neutral" mono
												>{item.files.length} file{item.files.length !== 1 ? 's' : ''}</Badge
											>
										{/if}
									</div>
								{/if}
							</svelte:fragment>

							<svelte:fragment slot="expanded" let:row={item}>
								<div class="space-y-3 p-4">
									{#if item.folder}
										<div class="space-y-1 border-b border-border pb-3">
											<div class="mb-1 text-xs font-medium text-text-muted">Folder</div>
											<div class="flex gap-2">
												<span class="w-12 shrink-0 text-xs font-medium text-text-muted">From:</span>
												<span class="font-mono text-xs break-all text-text-soft">
													{item.folder.existingPath}
												</span>
											</div>
											<div class="flex gap-2">
												<span class="w-12 shrink-0 text-xs font-medium text-success-icon">To:</span>
												<span class="font-mono text-xs break-all text-text-soft">
													{item.folder.newPath}
												</span>
											</div>
										</div>
									{/if}
									{#each item.files as file}
										<div class="space-y-1">
											<div class="flex gap-2">
												<span class="w-12 shrink-0 text-xs font-medium text-text-muted">From:</span>
												<span class="font-mono text-xs break-all text-text-soft">
													{getFileName(file.existingPath)}
												</span>
											</div>
											<div class="flex gap-2">
												<span class="w-12 shrink-0 text-xs font-medium text-success-icon">To:</span>
												<span class="font-mono text-xs break-all text-text-soft">
													{getFileName(file.newPath)}
												</span>
											</div>
										</div>
									{/each}
								</div>
							</svelte:fragment>
						</ExpandableTable>
					</div>
				{/if}
			</div>
		</svelte:fragment>
	</ExpandableTable>

	<div class="mt-3 flex justify-center">
		<Pagination {currentPage} {totalPages} onPageChange={(p) => (currentPage = p)} />
	</div>
</div>
