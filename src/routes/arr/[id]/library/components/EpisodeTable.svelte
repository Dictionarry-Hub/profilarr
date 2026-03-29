<script lang="ts">
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import ProgressIndicator from '$ui/arr/ProgressIndicator.svelte';
	import CustomFormatBadge from '$ui/arr/CustomFormatBadge.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import type { Column } from '$ui/table/types';
	import type { SonarrEpisodeItem } from '$utils/arr/types.ts';

	export let episodes: SonarrEpisodeItem[];

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
			key: 'progress',
			header: 'Score',
			align: 'right',
			width: 'w-76',
			sortable: true,
			sortAccessor: (row) => row.customFormatScore,
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
				<span class="text-sm text-neutral-900 dark:text-neutral-100">{row.title}</span>
				{#if row.size}
					<span class="ml-2 font-mono text-xs text-neutral-400">{formatSize(row.size)}</span>
				{/if}
			</div>
		{:else if column.key === 'qualityName'}
			<Badge variant="neutral" mono>{row.qualityName ?? 'N/A'}</Badge>
		{:else if column.key === 'progress'}
			{#if row.hasFile}
				<ProgressIndicator
					current={row.customFormatScore}
					target={row.cutoffScore}
					met={row.cutoffMet}
					mode="compact"
				/>
			{/if}
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="expanded" let:row>
		<div class="flex flex-col gap-2 px-4 py-2">
			{#if row.fileName}
				<code class="font-mono text-xs break-all text-neutral-600 dark:text-neutral-400"
					>{row.fileName}</code
				>
			{/if}

			{#if row.scoreBreakdown.length > 0}
				<div class="flex flex-wrap items-center gap-1.5">
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
