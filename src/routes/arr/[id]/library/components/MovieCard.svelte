<script lang="ts">
	import { Film, Check, CircleAlert } from 'lucide-svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import Score from '$ui/arr/Score.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import type { RadarrLibraryItem } from '$utils/arr/types.ts';

	export let movie: RadarrLibraryItem;
	export let baseUrl: string = '';

	$: posterUrl = movie.images?.find((i) => i.coverType === 'poster')?.remoteUrl;

	function getProgressColor(progress: number, cutoffMet: boolean): string {
		if (cutoffMet) return 'bg-green-500 dark:bg-green-400';
		if (progress >= 0.75) return 'bg-yellow-500 dark:bg-yellow-400';
		if (progress >= 0.5) return 'bg-orange-500 dark:bg-orange-400';
		return 'bg-red-500 dark:bg-red-400';
	}
</script>

<a
	href="{baseUrl}/movie/{movie.tmdbId}"
	target="_blank"
	rel="noopener noreferrer"
	class="group flex flex-col overflow-hidden rounded-xl border border-neutral-300 bg-neutral-50 transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-900 dark:hover:bg-neutral-800/60"
>
	<!-- Poster -->
	<div class="relative aspect-[2/3] w-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
		{#if posterUrl}
			<img src={posterUrl} alt={movie.title} loading="lazy" class="h-full w-full object-cover" />
		{:else}
			<div class="flex h-full w-full items-center justify-center">
				<Film class="h-12 w-12 text-neutral-400 dark:text-neutral-600" />
			</div>
		{/if}
		<!-- Monitored indicator -->
		<div class="absolute top-2 left-2">
			<IconCheckbox
				checked={movie.monitored}
				icon={Check}
				color={movie.monitored ? 'green' : 'neutral'}
				shape="circle"
			/>
		</div>
	</div>

	<!-- Content -->
	<div class="flex flex-1 flex-col gap-2 p-3">
		<!-- Title + Year -->
		<div class="min-w-0">
			<h3
				class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100"
				title={movie.title}
			>
				{movie.title}
			</h3>
			{#if movie.year}
				<span class="text-xs text-neutral-500 dark:text-neutral-400">{movie.year}</span>
			{/if}
		</div>

		<!-- Profile -->
		<Tooltip text={movie.isProfilarrProfile ? '' : 'Not managed by Profilarr'} position="top">
			<Badge
				variant={movie.isProfilarrProfile ? 'accent' : 'warning'}
				icon={movie.isProfilarrProfile ? null : CircleAlert}
				mono
			>
				{movie.qualityProfileName}
			</Badge>
		</Tooltip>

		<!-- Quality + Score -->
		{#if movie.hasFile}
			<div class="flex flex-wrap items-center gap-1.5">
				{#if movie.qualityName}
					<Badge variant="neutral" mono>{movie.qualityName}</Badge>
				{/if}
				<div class="text-xs">
					<Score score={movie.customFormatScore} showSign={false} colored={false} />
					<span class="text-neutral-500 dark:text-neutral-400">
						/ {movie.cutoffScore.toLocaleString()}
					</span>
				</div>
			</div>

			<!-- Progress bar -->
			<div class="flex items-center gap-2">
				<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
					<div
						class="h-full rounded-full transition-all {getProgressColor(
							movie.progress,
							movie.cutoffMet
						)}"
						style="width: {Math.max(0, Math.min(movie.progress * 100, 100))}%"
					></div>
				</div>
				{#if movie.cutoffMet}
					<Check size={14} class="flex-shrink-0 text-green-600 dark:text-green-400" />
				{:else}
					<span class="font-mono text-xs text-neutral-500 dark:text-neutral-400">
						{Math.max(0, Math.min(Math.round(movie.progress * 100), 100))}%
					</span>
				{/if}
			</div>
		{/if}
	</div>
</a>
