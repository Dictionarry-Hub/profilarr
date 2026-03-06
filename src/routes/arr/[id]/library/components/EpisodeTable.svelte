<script lang="ts">
	import { Check } from 'lucide-svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Score from '$ui/arr/Score.svelte';
	import CustomFormatBadge from '$ui/arr/CustomFormatBadge.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import type { Column } from '$ui/table/types';
	import type { SonarrEpisodeItem } from '$utils/arr/types.ts';

	export let episodes: SonarrEpisodeItem[];

	function getProgressColor(progress: number, cutoffMet: boolean): string {
		if (cutoffMet) return 'bg-green-500 dark:bg-green-400';
		if (progress >= 0.75) return 'bg-yellow-500 dark:bg-yellow-400';
		if (progress >= 0.5) return 'bg-orange-500 dark:bg-orange-400';
		return 'bg-red-500 dark:bg-red-400';
	}

	function formatSize(bytes: number | undefined): string {
		if (!bytes) return '-';
		const gb = bytes / (1024 * 1024 * 1024);
		if (gb >= 1) return `${gb.toFixed(1)} GB`;
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(0)} MB`;
	}

	const columns: Column<SonarrEpisodeItem>[] = [
		{ key: 'episodeNumber', header: 'Ep', align: 'center', width: 'w-12', sortable: true },
		{ key: 'title', header: 'Title', align: 'left', sortable: true },
		{ key: 'qualityName', header: 'Quality', align: 'left', width: 'w-28', sortable: true },
		{
			key: 'customFormatScore',
			header: 'Score',
			align: 'right',
			width: 'w-24',
			sortable: true,
			defaultSortDirection: 'desc'
		},
		{
			key: 'progress',
			header: 'Progress',
			align: 'center',
			width: 'w-32',
			sortable: true,
			sortAccessor: (row) => row.progress,
			defaultSortDirection: 'desc'
		}
	];

	$: sortedEpisodes = [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
</script>

<ExpandableTable
	{columns}
	data={sortedEpisodes}
	getRowId={(row) => row.id}
	compact
	flushExpanded
	chevronPosition="right"
	emptyMessage="No episodes"
	disableExpandWhen={(row) => !row.hasFile || (row.scoreBreakdown.length === 0 && !row.fileName)}
>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'episodeNumber'}
			<span class="font-mono text-xs text-neutral-500 dark:text-neutral-400">
				{row.episodeNumber}
			</span>
		{:else if column.key === 'title'}
			<div>
				<span class="text-neutral-900 dark:text-neutral-100">{row.title}</span>
				{#if row.size}
					<span class="ml-2 text-xs text-neutral-400">{formatSize(row.size)}</span>
				{/if}
			</div>
		{:else if column.key === 'qualityName'}
			<Badge variant="neutral" mono>{row.qualityName ?? 'N/A'}</Badge>
		{:else if column.key === 'customFormatScore'}
			<div class="text-right">
				<Score score={row.customFormatScore} showSign={false} colored={false} />
				<span class="text-xs text-neutral-500 dark:text-neutral-400">
					/ {row.cutoffScore.toLocaleString()}
				</span>
			</div>
		{:else if column.key === 'progress'}
			<div class="flex items-center gap-2">
				<div class="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
					<div
						class="h-full rounded-full transition-all {getProgressColor(
							row.progress,
							row.cutoffMet
						)}"
						style="width: {Math.min(row.progress * 100, 100)}%"
					></div>
				</div>
				{#if row.cutoffMet}
					<Check size={16} class="flex-shrink-0 text-green-600 dark:text-green-400" />
				{:else}
					<span class="w-10 text-right font-mono text-xs text-neutral-500 dark:text-neutral-400">
						{Math.round(row.progress * 100)}%
					</span>
				{/if}
			</div>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="expanded" let:row>
		<div class="flex flex-col gap-3 p-4">
			{#if row.fileName}
				<code class="font-mono text-xs break-all text-neutral-600 dark:text-neutral-400"
					>{row.fileName}</code
				>
			{/if}

			{#if row.scoreBreakdown.length > 0}
				<div class="flex flex-wrap items-center gap-2">
					{#each [...row.scoreBreakdown].sort((a, b) => b.score - a.score) as item}
						<CustomFormatBadge name={item.name} score={item.score} />
					{/each}
				</div>
			{:else}
				<div class="text-xs text-neutral-500 dark:text-neutral-400">No custom formats matched</div>
			{/if}
		</div>
	</svelte:fragment>
</ExpandableTable>
