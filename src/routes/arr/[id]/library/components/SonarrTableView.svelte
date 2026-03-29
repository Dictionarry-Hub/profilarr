<script lang="ts">
	import { ExternalLink } from 'lucide-svelte';
	import Button from '$ui/button/Button.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import type { Column, SortState } from '$ui/table/types';
	import type { SonarrLibraryItem, SonarrEpisodeItem } from '$utils/arr/types.ts';
	import { sortTitle } from '$shared/utils/sort.ts';

	import ProgressIndicator from '$ui/arr/ProgressIndicator.svelte';
	import SeriesRow from './SeriesRow.svelte';
	import SeriesRowSkeleton from './SeriesRowSkeleton.svelte';
	import SeasonTable from './SeasonTable.svelte';

	export let data: SonarrLibraryItem[];
	export let loading = false;
	export let baseUrl = '';
	export let expandAll = false;
	export let instanceId: number;
	export let emptyMessage = 'No series found';
	export let visibleColumns: Set<string>;

	const TOGGLEABLE_COLUMNS = ['episodes', 'sizeOnDisk', 'status', 'dateAdded'] as const;
	type ToggleableColumn = (typeof TOGGLEABLE_COLUMNS)[number];

	const allColumns: Column<SonarrLibraryItem>[] = [
		{
			key: 'title',
			header: 'Title',
			align: 'left',
			sortable: true,
			sortAccessor: (row) => sortTitle(row.title)
		},
		{ key: 'status', header: 'Status', align: 'left', width: 'w-28', sortable: true },
		{ key: 'qualityProfileName', header: 'Profile', align: 'left', width: 'w-40', sortable: true },
		{
			key: 'episodes',
			header: 'Episodes',
			align: 'right',
			width: 'w-36',
			sortable: true,
			sortAccessor: (row) => row.percentOfEpisodes,
			defaultSortDirection: 'desc'
		},
		{
			key: 'sizeOnDisk',
			header: 'Size',
			align: 'right',
			width: 'w-32',
			sortable: true,
			sortAccessor: (row) => row.sizeOnDisk,
			defaultSortDirection: 'desc'
		},
		{
			key: 'dateAdded',
			header: 'Added',
			align: 'right',
			width: 'w-28',
			sortable: true,
			sortAccessor: (row) => (row.dateAdded ? new Date(row.dateAdded).getTime() : 0),
			defaultSortDirection: 'desc'
		}
	];

	$: columns = allColumns.filter(
		(col) =>
			col.key === 'title' ||
			col.key === 'qualityProfileName' ||
			visibleColumns.has(col.key as ToggleableColumn)
	);

	const defaultSort: SortState = { key: 'title', direction: 'asc' };

	const skeletonData: SonarrLibraryItem[] = Array.from({ length: 12 }, (_, i) => ({
		id: i,
		title: '',
		year: 0,
		qualityProfileId: 0,
		qualityProfileName: '',
		monitored: true,
		seasonCount: 0,
		episodeCount: 0,
		episodeFileCount: 0,
		totalEpisodeCount: 0,
		sizeOnDisk: 0,
		percentOfEpisodes: 0,
		dateAdded: '',
		seasons: [],
		isProfilarrProfile: false
	})) as unknown as SonarrLibraryItem[];

	// ==========================================================================
	// Episode Lazy Loading
	// ==========================================================================

	let episodeCache: Map<number, SonarrEpisodeItem[]> = new Map();
	let episodeLoadingSet: Set<number> = new Set();

	async function loadEpisodes(seriesId: number) {
		if (episodeCache.has(seriesId) || episodeLoadingSet.has(seriesId)) return;

		episodeLoadingSet.add(seriesId);
		episodeLoadingSet = episodeLoadingSet;

		try {
			const response = await fetch(
				`/api/v1/arr/library/episodes?instanceId=${instanceId}&seriesId=${seriesId}`
			);
			if (!response.ok) throw new Error('Failed to fetch episodes');
			const result = await response.json();
			episodeCache.set(seriesId, result.episodes);
			episodeCache = episodeCache;
		} catch (err) {
			console.error(`Failed to load episodes for series ${seriesId}:`, err);
		} finally {
			episodeLoadingSet.delete(seriesId);
			episodeLoadingSet = episodeLoadingSet;
		}
	}

	$: episodesBySeriesAndSeason = (() => {
		const result = new Map<number, Map<number, SonarrEpisodeItem[]>>();
		for (const [seriesId, episodes] of episodeCache) {
			const seasonMap = new Map<number, SonarrEpisodeItem[]>();
			for (const ep of episodes) {
				const existing = seasonMap.get(ep.seasonNumber) ?? [];
				existing.push(ep);
				seasonMap.set(ep.seasonNumber, existing);
			}
			result.set(seriesId, seasonMap);
		}
		return result;
	})();

	let expandedRows: Set<string | number> = new Set();

	$: if (expandAll) {
		expandedRows = new Set(data.map((row) => row.id));
	} else if (!expandAll && expandedRows.size === data.length) {
		expandedRows = new Set();
	}

	$: if (expandedRows.size > 0) {
		for (const id of expandedRows) {
			const numId = typeof id === 'string' ? parseInt(id) : id;
			loadEpisodes(numId);
		}
	}

	export function resetEpisodeCache() {
		episodeCache = new Map();
		episodeLoadingSet = new Set();
	}
</script>

<ExpandableTable
	{columns}
	data={loading ? skeletonData : data}
	getRowId={(row) => row.id}
	compact={true}
	{defaultSort}
	pageSize={25}
	responsive
	flushExpanded
	bind:expandedRows
	{emptyMessage}
>
	<svelte:fragment slot="cell" let:row let:column>
		{#if loading}
			<SeriesRowSkeleton {column} />
		{:else if column.key === 'episodes'}
			<ProgressIndicator
				current={row.episodeFileCount}
				target={row.episodeCount}
				met={row.episodeFileCount === row.episodeCount}
				mode="compact"
			/>
		{:else}
			<SeriesRow {row} {column} />
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="actions" let:row>
		{#if !loading && row.tvdbId}
			<Button
				icon={ExternalLink}
				size="xs"
				variant="secondary"
				href="{baseUrl}/series/{row.titleSlug ??
					row.title
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, '-')
						.replace(/^-+|-+$/g, '')}"
				target="_blank"
				rel="noopener noreferrer"
				tooltip="Open in Sonarr"
				on:click={(e) => e.stopPropagation()}
			/>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="expanded" let:row>
		{#if !loading}
			{@const seriesId = row.id}
			{@const isEpisodeLoading = episodeLoadingSet.has(seriesId)}
			{@const episodesBySeasonNumber = episodesBySeriesAndSeason.get(seriesId) ?? new Map()}

			{#if isEpisodeLoading}
				<div class="flex items-center gap-2 p-4 text-sm text-neutral-500 dark:text-neutral-400">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-accent-500"
					></div>
					Loading episodes...
				</div>
			{:else}
				<div class="p-4">
					<SeasonTable seasons={row.seasons} {episodesBySeasonNumber} />
				</div>
			{/if}
		{/if}
	</svelte:fragment>
</ExpandableTable>
