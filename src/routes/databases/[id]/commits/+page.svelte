<script lang="ts">
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import type { Column } from '$ui/table/types';
	import { afterNavigate } from '$app/navigation';
	import { ExternalLink, FileText } from 'lucide-svelte';
	import type { PageData } from './$types';
	import type { Commit } from '$utils/git/types';
	import { parseUTC } from '$shared/utils/dates';

	export let data: PageData;

	let loading = true;
	let commits: Commit[] = [];
	let branch = '';
	let repositoryUrl = '';

	async function fetchCommits() {
		loading = true;
		try {
			const response = await fetch(`/databases/${data.database.id}/commits/data`);
			if (response.ok) {
				const result = await response.json();
				commits = result.commits;
				branch = result.branch;
				repositoryUrl = result.repositoryUrl;
			}
		} finally {
			loading = false;
		}
	}

	afterNavigate(() => {
		fetchCommits();
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
	<title>Commits - {data.database.name} - Profilarr</title>
</svelte:head>

<div class="mt-6 space-y-6">
	{#if loading}
		<!-- Skeleton Table -->
		<div class="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
			<table class="w-full">
				<thead
					class="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800"
				>
					<tr>
						<th class="w-8 px-3 py-3"></th>
						<th
							class="w-24 px-6 py-3 text-left text-xs font-medium tracking-wider text-neutral-700 uppercase dark:text-neutral-300"
							>Commit</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium tracking-wider text-neutral-700 uppercase dark:text-neutral-300"
							>Message</th
						>
						<th
							class="w-40 px-6 py-3 text-left text-xs font-medium tracking-wider text-neutral-700 uppercase dark:text-neutral-300"
							>Author</th
						>
						<th
							class="w-28 px-6 py-3 text-right text-xs font-medium tracking-wider text-neutral-700 uppercase dark:text-neutral-300"
							>Date</th
						>
					</tr>
				</thead>
				<tbody
					class="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-900"
				>
					{#each Array(10) as _}
						<tr class="animate-pulse">
							<td class="px-3 py-4"
								><div class="h-4 w-4 rounded bg-neutral-200 dark:bg-neutral-700"></div></td
							>
							<td class="px-6 py-4"
								><div class="h-4 w-16 rounded bg-neutral-200 dark:bg-neutral-700"></div></td
							>
							<td class="px-6 py-4"
								><div class="h-4 w-64 rounded bg-neutral-200 dark:bg-neutral-700"></div></td
							>
							<td class="px-6 py-4"
								><div class="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-700"></div></td
							>
							<td class="px-6 py-4 text-right"
								><div class="ml-auto h-4 w-16 rounded bg-neutral-200 dark:bg-neutral-700"></div></td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<ExpandableTable
			{columns}
			data={commits}
			getRowId={(row) => row.hash}
			emptyMessage="No commits found"
			defaultSort={{ key: 'date', direction: 'desc' }}
			chevronPosition="right"
			responsive
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
	{/if}
</div>
