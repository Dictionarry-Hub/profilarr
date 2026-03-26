<script lang="ts">
	import { Tv, CircleAlert, Check } from 'lucide-svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import type { SonarrLibraryItem } from '$utils/arr/types.ts';

	export let series: SonarrLibraryItem;
	export let baseUrl: string = '';

	$: posterUrl = series.images?.find((i) => i.coverType === 'poster')?.remoteUrl;

	$: monitoredState = (() => {
		if (!series.monitored) return 'unmonitored';
		const seasons = series.seasons ?? [];
		if (seasons.length === 0) return 'monitored';
		const allMonitored = seasons.every((s) => s.monitored);
		return allMonitored ? 'monitored' : 'partial';
	})();

	$: slug = series.title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	function formatSize(bytes: number): string {
		if (!bytes) return '-';
		const gb = bytes / (1024 * 1024 * 1024);
		if (gb >= 1) return `${gb.toFixed(1)} GB`;
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(0)} MB`;
	}
</script>

<a
	href="{baseUrl}/series/{slug}"
	target="_blank"
	rel="noopener noreferrer"
	class="group flex flex-col overflow-hidden rounded-xl border border-neutral-300 bg-neutral-50 transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-900 dark:hover:bg-neutral-800/60"
>
	<!-- Poster -->
	<div class="relative aspect-[2/3] w-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
		{#if posterUrl}
			<img src={posterUrl} alt={series.title} loading="lazy" class="h-full w-full object-cover" />
		{:else}
			<div class="flex h-full w-full items-center justify-center">
				<Tv class="h-12 w-12 text-neutral-400 dark:text-neutral-600" />
			</div>
		{/if}
		<!-- Monitored indicator -->
		<div class="absolute top-2 left-2">
			<IconCheckbox
				checked={monitoredState !== 'unmonitored'}
				icon={Check}
				color={monitoredState === 'monitored'
					? 'green'
					: monitoredState === 'partial'
						? '#EAB308'
						: 'neutral'}
				shape="circle"
			/>
		</div>
		<!-- Episode count overlay -->
		<div
			class="absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-xs font-medium {series.episodeFileCount ===
			series.episodeCount
				? 'bg-green-600/90 text-white'
				: 'bg-neutral-900/70 text-neutral-200'}"
		>
			{series.episodeFileCount}/{series.episodeCount}
		</div>
	</div>

	<!-- Content -->
	<div class="flex flex-1 flex-col gap-2 p-3">
		<!-- Title + Year -->
		<div class="min-w-0">
			<h3
				class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100"
				title={series.title}
			>
				{series.title}
			</h3>
			<div class="flex items-center gap-1.5">
				{#if series.year}
					<span class="text-xs text-neutral-500 dark:text-neutral-400">{series.year}</span>
				{/if}
				{#if series.network}
					<span class="text-xs text-neutral-400 dark:text-neutral-500">·</span>
					<span class="text-xs text-neutral-500 dark:text-neutral-400">{series.network}</span>
				{/if}
			</div>
		</div>

		<!-- Profile -->
		<Tooltip text={series.isProfilarrProfile ? '' : 'Not managed by Profilarr'} position="top">
			<Badge
				variant={series.isProfilarrProfile ? 'accent' : 'warning'}
				icon={series.isProfilarrProfile ? null : CircleAlert}
				mono
			>
				{series.qualityProfileName}
			</Badge>
		</Tooltip>

		<!-- Size -->
		{#if series.sizeOnDisk}
			<span class="text-xs text-neutral-500 dark:text-neutral-400">
				{formatSize(series.sizeOnDisk)}
			</span>
		{/if}
	</div>
</a>
