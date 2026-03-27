<script lang="ts">
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import ProgressIndicator from '$ui/arr/ProgressIndicator.svelte';
	import type { Column } from '$ui/table/types';
	import type { SonarrSeasonItem, SonarrEpisodeItem } from '$utils/arr/types.ts';
	import EpisodeTable from './EpisodeTable.svelte';

	export let seasons: SonarrSeasonItem[];
	export let episodesBySeasonNumber: Map<number, SonarrEpisodeItem[]>;

	function formatSize(bytes: number): string {
		if (!bytes) return '-';
		const gb = bytes / (1024 * 1024 * 1024);
		if (gb >= 1) return `${gb.toFixed(1)} GB`;
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(0)} MB`;
	}

	function getSeasonLabel(seasonNumber: number): string {
		return seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`;
	}

	const columns: Column<SonarrSeasonItem>[] = [
		{ key: 'seasonNumber', header: 'Season', align: 'left', sortable: true },
		{
			key: 'episodeFileCount',
			header: 'Episodes',
			align: 'right',
			width: 'w-36',
			sortable: true,
			defaultSortDirection: 'desc'
		},
		{
			key: 'sizeOnDisk',
			header: 'Size',
			align: 'right',
			width: 'w-24',
			sortable: true,
			sortAccessor: (row) => row.sizeOnDisk,
			defaultSortDirection: 'desc'
		}
	];

	// Filter out seasons with no episodes
	$: visibleSeasons = seasons
		.filter((s) => s.totalEpisodeCount > 0)
		.sort((a, b) => a.seasonNumber - b.seasonNumber);
</script>

<ExpandableTable
	{columns}
	data={visibleSeasons}
	getRowId={(row) => row.seasonNumber}
	compact
	flushExpanded
	chevronPosition="right"
	emptyMessage="No seasons"
	disableExpandWhen={(row) => row.episodeFileCount === 0}
>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'seasonNumber'}
			<span class="font-medium text-neutral-900 dark:text-neutral-100">
				{getSeasonLabel(row.seasonNumber)}
			</span>
		{:else if column.key === 'episodeFileCount'}
			<ProgressIndicator
				current={row.episodeFileCount}
				target={row.episodeCount}
				met={row.episodeFileCount === row.episodeCount}
				mode="compact"
			/>
		{:else if column.key === 'sizeOnDisk'}
			<span class="font-mono text-xs text-neutral-700 dark:text-neutral-300"
				>{formatSize(row.sizeOnDisk)}</span
			>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="expanded" let:row>
		{@const seasonEpisodes = episodesBySeasonNumber.get(row.seasonNumber) ?? []}
		<div class="p-4">
			<EpisodeTable episodes={seasonEpisodes} />
		</div>
	</svelte:fragment>
</ExpandableTable>
