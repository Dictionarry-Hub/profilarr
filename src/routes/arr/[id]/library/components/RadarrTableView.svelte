<script lang="ts">
	import { ExternalLink } from 'lucide-svelte';
	import Button from '$ui/button/Button.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import type { Column, SortState } from '$ui/table/types';
	import type { RadarrLibraryItem } from '$utils/arr/types.ts';
	import { sortTitle } from '$shared/utils/sort.ts';

	import ProgressIndicator from '$ui/arr/ProgressIndicator.svelte';
	import MovieRow from './MovieRow.svelte';
	import MovieRowSkeleton from './MovieRowSkeleton.svelte';

	export let data: RadarrLibraryItem[];
	export let loading = false;
	export let baseUrl = '';
	export let expandAll = false;
	export let emptyMessage = 'No movies with files';
	export let visibleColumns: Set<string>;

	let expandedRows: Set<string | number> = new Set();

	$: if (expandAll) {
		expandedRows = new Set(data.map((row) => row.id));
	} else {
		expandedRows = new Set();
	}

	const TOGGLEABLE_COLUMNS = [
		'qualityName',
		'score',
		'releaseGroup',
		'sizeOnDisk',
		'status',
		'popularity',
		'dateAdded'
	] as const;
	type ToggleableColumn = (typeof TOGGLEABLE_COLUMNS)[number];

	const allColumns: Column<RadarrLibraryItem>[] = [
		{
			key: 'title',
			header: 'Title',
			align: 'left',
			sortable: true,
			sortAccessor: (row) => sortTitle(row.title)
		},
		{ key: 'status', header: 'Status', align: 'left', width: 'w-28', sortable: true },
		{ key: 'qualityName', header: 'Quality', align: 'left', width: 'w-32', sortable: true },
		{ key: 'qualityProfileName', header: 'Profile', align: 'left', width: 'w-40', sortable: true },
		{
			key: 'score',
			header: 'Score',
			align: 'right',
			width: 'w-48',
			sortable: true,
			sortAccessor: (row) => row.customFormatScore,
			defaultSortDirection: 'desc'
		},
		{
			key: 'sizeOnDisk',
			header: 'Size',
			align: 'right',
			width: 'w-24',
			sortable: true,
			sortAccessor: (row) => row.sizeOnDisk ?? 0,
			defaultSortDirection: 'desc'
		},
		{
			key: 'popularity',
			header: 'Popularity',
			align: 'right',
			width: 'w-24',
			sortable: true,
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
		},
		{ key: 'releaseGroup', header: 'Group', align: 'left', width: 'w-28', sortable: true }
	];

	$: columns = allColumns.filter(
		(col) =>
			col.key === 'title' ||
			col.key === 'qualityProfileName' ||
			visibleColumns.has(col.key as ToggleableColumn)
	);

	const defaultSort: SortState = { key: 'title', direction: 'asc' };

	const skeletonData: RadarrLibraryItem[] = Array.from({ length: 12 }, (_, i) => ({
		id: `skeleton-${i}`,
		title: '',
		year: 0,
		tmdbId: 0,
		hasFile: true,
		monitored: true,
		qualityProfileId: 0,
		qualityProfileName: '',
		isProfilarrProfile: false,
		qualityName: null,
		customFormatScore: 0,
		cutoffScore: 0,
		cutoffMet: false,
		progress: 0,
		popularity: 0,
		dateAdded: '',
		fileName: null,
		scoreBreakdown: []
	})) as unknown as RadarrLibraryItem[];
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
			<MovieRowSkeleton {column} />
		{:else if column.key === 'score'}
			<ProgressIndicator
				current={row.customFormatScore}
				target={row.cutoffScore}
				met={row.cutoffMet}
				mode="compact"
			/>
		{:else}
			<MovieRow {row} {column} mode="cell" />
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="actions" let:row>
		{#if !loading && row.tmdbId}
			<Button
				icon={ExternalLink}
				size="xs"
				variant="secondary"
				href="{baseUrl}/movie/{row.tmdbId}"
				target="_blank"
				rel="noopener noreferrer"
				tooltip="Open in Radarr"
				on:click={(e) => e.stopPropagation()}
			/>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="expanded" let:row>
		{#if !loading}
			<div class="p-4">
				<MovieRow {row} column={allColumns[0]} mode="expanded" />
			</div>
		{/if}
	</svelte:fragment>
</ExpandableTable>
