<script lang="ts">
	import type { Column } from '$ui/table/types';
	import type { SonarrSeriesItem } from '$utils/arr/types.ts';

	export let column: Column<SonarrSeriesItem>;

	const widths = ['w-24', 'w-32', 'w-40', 'w-28', 'w-36'];
	const randomWidth = () => widths[Math.floor(Math.random() * widths.length)];
</script>

{#if column.key === 'title'}
	<div class="space-y-1.5">
		<div class="h-4 {randomWidth()} animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"></div>
		<div class="h-3 w-12 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800"></div>
	</div>
{:else if column.key === 'qualityProfileName'}
	<div class="h-5 w-20 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700"></div>
{:else if column.key === 'episodes'}
	<div class="h-5 w-14 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700"></div>
{:else if column.key === 'sizeOnDisk'}
	<div class="h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"></div>
{:else if column.key === 'releaseGroups'}
	<div class="h-4 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"></div>
{:else if column.key === 'dateAdded'}
	<div class="h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"></div>
{/if}
