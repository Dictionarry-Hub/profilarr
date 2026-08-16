<script lang="ts">
	import { ExternalLink } from '@lucide/svelte';
	import Button from '$ui/button/Button.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import type { Column, SortState } from '$ui/table/types';
	import type { SonarrSeriesItem, SonarrSeasonItem, SonarrEpisodeItem } from '$utils/arr/types.ts';
	import { sortTitle } from '$shared/utils/sort.ts';

	import ProgressIndicator from '$ui/arr/ProgressIndicator.svelte';
	import SeriesRow from './SeriesRow.svelte';
	import SeriesRowSkeleton from './SeriesRowSkeleton.svelte';
	import SeasonTable from './SeasonTable.svelte';

	export let data: SonarrSeriesItem[];
	export let loading = false;
	export let baseUrl = '';
	export let expandAll = false;
	export let instanceId: number;
	export let emptyMessage = 'No series found';
	export let visibleColumns: Set<string>;
	export let highlightGroups: string[] = [];

	const TOGGLEABLE_COLUMNS = [
		'episodes',
		'sizeOnDisk',
		'releaseGroups',
		'status',
		'dateAdded'
	] as const;
	type ToggleableColumn = (typeof TOGGLEABLE_COLUMNS)[number];

	const allColumns: Column<SonarrSeriesItem>[] = [
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
			key: 'releaseGroups',
			header: 'Release Group(s)',
			align: 'left',
			width: 'w-40',
			sortable: true,
			sortAccessor: (row) => row.releaseGroups?.[0] ?? ''
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

	const skeletonData: SonarrSeriesItem[] = Array.from({ length: 12 }, (_, i) => ({
		id: i,
		title: '',
		year: 0,
		qualityProfileId: 0,
		qualityProfileName: '',
		monitored: true,
		monitoredState: 'monitored',
		seasonCount: 0,
		episodeCount: 0,
		episodeFileCount: 0,
		totalEpisodeCount: 0,
		sizeOnDisk: 0,
		percentOfEpisodes: 0,
		dateAdded: '',
		isProfilarrProfile: false
	})) as unknown as SonarrSeriesItem[];

	// ==========================================================================
	// Two-stage Lazy Loading (seasons → episodes)
	// ==========================================================================

	let seasonsCache: Map<number, SonarrSeasonItem[]> = new Map();
	let seasonsLoadingSet: Set<number> = new Set();
	let episodeCache: Map<string, SonarrEpisodeItem[]> = new Map();
	let episodeLoadingSet: Set<string> = new Set();

	const episodeKey = (seriesId: number, seasonNumber: number) => `${seriesId}:${seasonNumber}`;

	async function loadSeasons(seriesId: number) {
		if (seasonsCache.has(seriesId) || seasonsLoadingSet.has(seriesId)) return;

		seasonsLoadingSet.add(seriesId);
		seasonsLoadingSet = seasonsLoadingSet;

		try {
			const response = await fetch(`/arr/${instanceId}/library/series/${seriesId}/seasons`);
			if (!response.ok) throw new Error('Failed to fetch seasons');
			const result = await response.json();
			seasonsCache.set(seriesId, result.seasons);
			seasonsCache = seasonsCache;
		} catch (err) {
			console.error(`Failed to load seasons for series ${seriesId}:`, err);
		} finally {
			seasonsLoadingSet.delete(seriesId);
			seasonsLoadingSet = seasonsLoadingSet;
		}
	}

	async function loadSeasonEpisodes(seriesId: number, seasonNumber: number) {
		const key = episodeKey(seriesId, seasonNumber);
		if (episodeCache.has(key) || episodeLoadingSet.has(key)) return;

		episodeLoadingSet.add(key);
		episodeLoadingSet = episodeLoadingSet;

		try {
			const response = await fetch(
				`/arr/${instanceId}/library/series/${seriesId}/seasons/${seasonNumber}/episodes`
			);
			if (!response.ok) throw new Error('Failed to fetch episodes');
			const result = await response.json();
			episodeCache.set(key, result.episodes);
			episodeCache = episodeCache;
		} catch (err) {
			console.error(`Failed to load episodes for series ${seriesId} season ${seasonNumber}:`, err);
		} finally {
			episodeLoadingSet.delete(key);
			episodeLoadingSet = episodeLoadingSet;
		}
	}

	function episodesForSeries(
		cache: Map<string, SonarrEpisodeItem[]>,
		seriesId: number
	): Map<number, SonarrEpisodeItem[]> {
		const result = new Map<number, SonarrEpisodeItem[]>();
		const prefix = `${seriesId}:`;
		for (const [key, episodes] of cache) {
			if (!key.startsWith(prefix)) continue;
			const seasonNumber = Number(key.slice(prefix.length));
			result.set(seasonNumber, episodes);
		}
		return result;
	}

	function episodeLoadingForSeries(loadingSet: Set<string>, seriesId: number): Set<number> {
		const result = new Set<number>();
		const prefix = `${seriesId}:`;
		for (const key of loadingSet) {
			if (!key.startsWith(prefix)) continue;
			result.add(Number(key.slice(prefix.length)));
		}
		return result;
	}

	let expandedRows: Set<string | number> = new Set();
	let previousExpandAll = expandAll;

	$: if (expandAll !== previousExpandAll) {
		expandedRows = expandAll ? new Set(data.map((row) => row.id)) : new Set();
		previousExpandAll = expandAll;
	}

	$: if (expandedRows.size > 0) {
		for (const id of expandedRows) {
			const numId = typeof id === 'string' ? parseInt(id) : id;
			loadSeasons(numId);
		}
	}

	export function resetEpisodeCache() {
		seasonsCache = new Map();
		seasonsLoadingSet = new Set();
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
			<SeriesRow {row} {column} {highlightGroups} />
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
			{@const isSeasonsLoading = seasonsLoadingSet.has(seriesId)}
			{@const seasons = seasonsCache.get(seriesId) ?? []}
			{@const episodesBySeasonNumber = episodesForSeries(episodeCache, seriesId)}
			{@const loadingSeasons = episodeLoadingForSeries(episodeLoadingSet, seriesId)}

			{#if isSeasonsLoading}
				<div class="flex items-center gap-2 p-4 text-sm text-neutral-500 dark:text-neutral-400">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-accent-500"
					></div>
					Loading seasons...
				</div>
			{:else}
				<div class="p-4">
					<SeasonTable
						{seasons}
						{episodesBySeasonNumber}
						{loadingSeasons}
						onExpandSeason={(seasonNumber) => loadSeasonEpisodes(seriesId, seasonNumber)}
					/>
				</div>
			{/if}
		{/if}
	</svelte:fragment>
</ExpandableTable>
