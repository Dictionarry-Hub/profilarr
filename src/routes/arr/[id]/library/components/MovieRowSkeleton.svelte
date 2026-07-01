<script lang="ts">
	import type { Column } from '$ui/table/types';
	import type { RadarrLibraryItem } from '$utils/arr/types.ts';

	export let column: Column<RadarrLibraryItem>;

	// Randomize widths slightly for organic feel
	const widths = ['w-24', 'w-32', 'w-40', 'w-28', 'w-36'];
	const randomWidth = () => widths[Math.floor(Math.random() * widths.length)];
</script>

{#if column.key === 'title'}
	<div class="space-y-1.5">
		<div class="h-4 {randomWidth()} animate-pulse rounded-control-sm bg-surface-hover"></div>
		<div class="h-3 w-12 animate-pulse rounded-control-sm bg-surface-hover"></div>
	</div>
{:else if column.key === 'qualityProfileName'}
	<div class="h-5 w-20 animate-pulse rounded-pill bg-surface-hover"></div>
{:else if column.key === 'qualityName'}
	<div class="h-6 w-16 animate-pulse rounded-control-sm bg-surface-hover"></div>
{:else if column.key === 'customFormatScore'}
	<div class="flex justify-end gap-1">
		<div class="h-4 w-10 animate-pulse rounded-control-sm bg-surface-hover"></div>
		<div class="h-4 w-12 animate-pulse rounded-control-sm bg-surface-hover"></div>
	</div>
{:else if column.key === 'progress'}
	<div class="flex items-center gap-2">
		<div class="h-2 flex-1 animate-pulse rounded-pill bg-surface-hover"></div>
		<div class="h-4 w-8 animate-pulse rounded-control-sm bg-surface-hover"></div>
	</div>
{:else if column.key === 'popularity'}
	<div class="h-4 w-8 animate-pulse rounded-control-sm bg-surface-hover"></div>
{:else if column.key === 'dateAdded'}
	<div class="h-4 w-16 animate-pulse rounded-control-sm bg-surface-hover"></div>
{:else if column.key === 'actions'}
	<div class="flex justify-center">
		<div class="h-7 w-7 animate-pulse rounded-control-sm border border-border"></div>
	</div>
{/if}
