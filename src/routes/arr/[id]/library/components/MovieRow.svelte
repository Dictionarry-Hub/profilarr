<script lang="ts">
	import { Check, CircleAlert, Film, CheckCircle, Megaphone, Clapperboard } from 'lucide-svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import Label from '$ui/label/Label.svelte';
	import Score from '$ui/arr/Score.svelte';
	import CustomFormatBadge from '$ui/arr/CustomFormatBadge.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import type { RadarrLibraryItem } from '$utils/arr/types.ts';
	import type { Column } from '$ui/table/types';

	export let row: RadarrLibraryItem;
	export let column: Column<RadarrLibraryItem>;
	export let mode: 'cell' | 'expanded' = 'cell';

	$: posterUrl = row.images?.find((i) => i.coverType === 'poster')?.remoteUrl;

	function getProgressColor(progress: number, cutoffMet: boolean): string {
		if (cutoffMet) return 'bg-green-500 dark:bg-green-400';
		if (progress >= 0.75) return 'bg-yellow-500 dark:bg-yellow-400';
		if (progress >= 0.5) return 'bg-orange-500 dark:bg-orange-400';
		return 'bg-red-500 dark:bg-red-400';
	}

	function formatDate(isoString?: string): string {
		if (!isoString) return '-';
		const date = new Date(isoString);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
	}
</script>

{#if mode === 'cell'}
	{#if column.key === 'monitored'}
		<IconCheckbox
			checked={row.monitored}
			icon={Check}
			color={row.monitored ? 'accent' : 'neutral'}
			shape="circle"
		/>
	{:else if column.key === 'title'}
		<div class="flex items-center gap-3">
			<div
				class="h-12 w-8 flex-shrink-0 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
			>
				{#if posterUrl}
					<img src={posterUrl} alt="" loading="lazy" class="h-full w-full object-cover" />
				{:else}
					<div class="flex h-full w-full items-center justify-center">
						<Film size={12} class="text-neutral-400 dark:text-neutral-600" />
					</div>
				{/if}
			</div>
			<div>
				<div class="font-medium text-neutral-900 dark:text-neutral-50">{row.title}</div>
				{#if row.year}
					<div class="text-xs text-neutral-500 dark:text-neutral-400">{row.year}</div>
				{/if}
			</div>
		</div>
	{:else if column.key === 'qualityProfileName'}
		<Tooltip text={row.isProfilarrProfile ? '' : 'Not managed by Profilarr'} position="top">
			<Badge
				variant={row.isProfilarrProfile ? 'accent' : 'warning'}
				icon={row.isProfilarrProfile ? null : CircleAlert}
				mono
			>
				{row.qualityProfileName}
			</Badge>
		</Tooltip>
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
					class="h-full rounded-full transition-all {getProgressColor(row.progress, row.cutoffMet)}"
					style="width: {Math.max(0, Math.min(row.progress * 100, 100))}%"
				></div>
			</div>
			{#if row.cutoffMet}
				<Check size={16} class="flex-shrink-0 text-green-600 dark:text-green-400" />
			{:else}
				<span class="w-10 text-right font-mono text-xs text-neutral-500 dark:text-neutral-400">
					{Math.max(0, Math.min(Math.round(row.progress * 100), 100))}%
				</span>
			{/if}
		</div>
	{:else if column.key === 'releaseGroup'}
		<span class="font-mono text-xs text-neutral-700 dark:text-neutral-300">
			{row.releaseGroup ?? '-'}
		</span>
	{:else if column.key === 'sizeOnDisk'}
		<span class="font-mono text-xs text-neutral-700 dark:text-neutral-300">
			{#if row.sizeOnDisk}
				{@const gb = row.sizeOnDisk / (1024 * 1024 * 1024)}
				{gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(row.sizeOnDisk / (1024 * 1024))} MB`}
			{:else}
				-
			{/if}
		</span>
	{:else if column.key === 'status'}
		{#if row.status === 'released'}
			<Label variant="success" size="sm"
				><svelte:component this={CheckCircle} size={12} /> Released</Label
			>
		{:else if row.status === 'inCinemas'}
			<Label variant="warning" size="sm"
				><svelte:component this={Clapperboard} size={12} /> In Cinemas</Label
			>
		{:else if row.status === 'announced'}
			<Label variant="info" size="sm"
				><svelte:component this={Megaphone} size={12} /> Announced</Label
			>
		{:else}
			<Label variant="secondary" size="sm">{row.status ?? '-'}</Label>
		{/if}
	{:else if column.key === 'popularity'}
		<span class="font-mono text-xs text-neutral-700 dark:text-neutral-300">
			{row.popularity?.toFixed(1) ?? '-'}
		</span>
	{:else if column.key === 'dateAdded'}
		<span class="font-mono text-xs text-neutral-700 dark:text-neutral-300">
			{formatDate(row.dateAdded)}
		</span>
	{/if}
{:else}
	<!-- Expanded content -->
	<div class="flex flex-col gap-3 p-4">
		<!-- File Name -->
		{#if row.fileName}
			<code class="font-mono text-xs break-all text-neutral-600 dark:text-neutral-400"
				>{row.fileName}</code
			>
		{/if}

		<!-- Custom Formats with Scores (sorted by score descending) -->
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
{/if}
