<script lang="ts">
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Label from '$ui/label/Label.svelte';
	import Pagination from '$ui/navigation/pagination/Pagination.svelte';
	import type { Column } from '$ui/table/types';
	import { afterNavigate } from '$app/navigation';
	import { ExternalLink, FileText } from 'lucide-svelte';
	import type { PageData } from './$types';
	import type { Commit } from '$utils/git/types';
	import { parseUTC } from '$shared/utils/dates';

	export let data: PageData;

	const pageSize = 20;

	let loading = true;
	let commits: Commit[] = [];
	let branch = '';
	let repositoryUrl = '';
	let currentPage = 1;
	let totalCount = 0;
	let fetchToken = 0;

	$: totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

	async function fetchCommits(page: number) {
		const token = ++fetchToken;
		loading = true;
		try {
			const response = await fetch(
				`/databases/${data.database.id}/commits/data?page=${page}&pageSize=${pageSize}`
			);
			if (token !== fetchToken) return;
			if (response.ok) {
				const result = await response.json();
				commits = result.commits;
				totalCount = result.totalCount;
				branch = result.branch;
				repositoryUrl = result.repositoryUrl;
				currentPage = result.page;
			}
		} finally {
			if (token === fetchToken) loading = false;
		}
	}

	function handlePageChange(page: number) {
		if (loading || page < 1 || page > totalPages) return;
		fetchCommits(page);
	}

	afterNavigate(() => {
		currentPage = 1;
		totalCount = 0;
		fetchCommits(1);
	});

	function parseDate(dateStr: string): Date | null {
		const parsed = parseUTC(dateStr) ?? new Date(dateStr);
		if (Number.isNaN(parsed.getTime())) return null;
		return parsed;
	}

	function getDateSortValue(dateStr: string): number {
		const parsed = parseDate(dateStr);
		return parsed ? parsed.getTime() : Number.NEGATIVE_INFINITY;
	}

	function formatDate(dateStr: string): string {
		const date = parseDate(dateStr);
		if (!date) return '-';
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMs < 0) return date.toLocaleDateString();
		if (diffDays === 0) {
			const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
			if (diffHours === 0) {
				const diffMins = Math.floor(diffMs / (1000 * 60));
				return `${diffMins}m ago`;
			}
			return `${diffHours}h ago`;
		}
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays}d ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

		return date.toLocaleDateString();
	}

	function getCommitUrl(hash: string): string {
		return `${repositoryUrl}/commit/${hash}`;
	}

	const columns: Column<Commit>[] = [
		{
			key: 'shortHash',
			header: 'Commit',
			width: 'w-24'
		},
		{
			key: 'status',
			header: 'Status',
			width: 'w-28'
		},
		{
			key: 'message',
			header: 'Message'
		},
		{
			key: 'author',
			header: 'Author',
			width: 'w-40'
		},
		{
			key: 'date',
			header: 'Date',
			width: 'w-28',
			align: 'right',
			sortable: true,
			defaultSortDirection: 'desc',
			sortAccessor: (row) => getDateSortValue(row.date)
		}
	];
</script>

<svelte:head>
	<title>Updates - {data.database.name} - Profilarr</title>
</svelte:head>

<div class="mt-6 space-y-6">
	<ExpandableTable
		{columns}
		data={commits}
		getRowId={(row) => row.hash}
		emptyMessage="No commits found"
		defaultSort={{ key: 'date', direction: 'desc' }}
		chevronPosition="right"
		responsive
		{loading}
		loadingRows={10}
	>
		<svelte:fragment slot="cell" let:row let:column>
			{#if column.key === 'shortHash'}
				<a
					href={getCommitUrl(row.hash)}
					target="_blank"
					rel="noopener noreferrer"
					on:click|stopPropagation
					class="inline-flex items-center gap-1.5 font-mono text-xs text-accent-600 hover:underline dark:text-accent-400"
				>
					{row.shortHash}
					<ExternalLink size={12} />
				</a>
			{:else if column.key === 'status'}
				{#if row.status === 'installed'}
					<Label variant="success" size="sm" rounded="md">Installed</Label>
				{:else}
					<Label variant="info" size="sm" rounded="md">Available</Label>
				{/if}
			{:else if column.key === 'message'}
				<span class="line-clamp-1 text-sm text-neutral-900 dark:text-neutral-100">
					{row.message}
				</span>
			{:else if column.key === 'author'}
				<span class="text-sm text-neutral-600 dark:text-neutral-400">
					{row.author}
				</span>
			{:else if column.key === 'date'}
				<span class="font-mono text-xs text-neutral-500 dark:text-neutral-400">
					{formatDate(row.date)}
				</span>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="expanded" let:row>
			<div class="space-y-2 p-4">
				<div class="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
					<FileText size={14} />
					<span>{row.files.length} file{row.files.length !== 1 ? 's' : ''} changed</span>
				</div>
				{#if row.files.length > 0}
					<div class="grid gap-1">
						{#each row.files as file}
							<code
								class="block rounded bg-neutral-100 px-2 py-1 font-mono text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
							>
								{file}
							</code>
						{/each}
					</div>
				{/if}
			</div>
		</svelte:fragment>
	</ExpandableTable>

	{#if totalPages > 1}
		<div class="flex justify-center">
			<Pagination {currentPage} {totalPages} onPageChange={handlePageChange} />
		</div>
	{/if}
</div>
