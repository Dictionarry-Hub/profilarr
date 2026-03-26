<script lang="ts">
	import { Tv, CircleAlert, Check, Info } from 'lucide-svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import Button from '$ui/button/Button.svelte';
	import CustomFormatBadge from '$ui/arr/CustomFormatBadge.svelte';
	import ProgressIndicator from '$ui/arr/ProgressIndicator.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import type { SonarrLibraryItem, SonarrEpisodeItem } from '$utils/arr/types.ts';

	export let series: SonarrLibraryItem;
	export let baseUrl: string = '';
	export let instanceId: number;

	$: posterUrl = series.images?.find((i) => i.coverType === 'poster')?.remoteUrl;

	$: monitoredState = (() => {
		if (!series.monitored) return 'unmonitored';
		const mainSeasons = (series.seasons ?? []).filter((s) => s.seasonNumber !== 0);
		if (mainSeasons.length === 0) return 'monitored';
		const allMonitored = mainSeasons.every((s) => s.monitored);
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

	// Episode detail modal
	let detailOpen = false;
	let episodes: SonarrEpisodeItem[] = [];
	let episodesLoading = false;
	let episodesLoaded = false;
	let seasonExpandedRows: Set<string | number> = new Set();

	async function openDetail() {
		detailOpen = true;
		if (episodesLoaded) return;
		episodesLoading = true;
		try {
			const response = await fetch(
				`/api/v1/arr/library/episodes?instanceId=${instanceId}&seriesId=${series.id}`
			);
			if (!response.ok) throw new Error('Failed to fetch episodes');
			const result = await response.json();
			episodes = result.episodes;
			episodesLoaded = true;
			// Expand all seasons except specials by default
			const seasonNumbers = new Set(episodes.map((ep) => ep.seasonNumber));
			seasonNumbers.delete(0);
			seasonExpandedRows = seasonNumbers;
		} catch (err) {
			console.error(`Failed to load episodes for series ${series.id}:`, err);
		} finally {
			episodesLoading = false;
		}
	}

	interface SeasonRow {
		seasonNumber: number;
		label: string;
		episodeCount: number;
		fileCount: number;
		episodes: SonarrEpisodeItem[];
	}

	$: seasonRows = (() => {
		const map = new Map<number, SonarrEpisodeItem[]>();
		for (const ep of episodes) {
			const existing = map.get(ep.seasonNumber) ?? [];
			existing.push(ep);
			map.set(ep.seasonNumber, existing);
		}
		return [...map.entries()]
			.sort((a, b) => (a[0] === 0 ? 1 : b[0] === 0 ? -1 : a[0] - b[0]))
			.map(([num, eps]) => ({
				seasonNumber: num,
				label: num === 0 ? 'Specials' : `Season ${num}`,
				episodeCount: eps.length,
				fileCount: eps.filter((e) => e.hasFile).length,
				episodes: eps
			}));
	})();

	const seasonColumns = [
		{ key: 'label', header: 'Season', align: 'left' as const, sortable: false },
		{ key: 'episodes', header: 'Episodes', align: 'right' as const, width: 'w-28', sortable: false }
	];
</script>

<div
	class="group flex flex-col overflow-hidden rounded-xl border border-neutral-300 bg-neutral-50 transition-colors dark:border-neutral-700/60 dark:bg-neutral-900"
>
	<!-- Poster -->
	<a
		href="{baseUrl}/series/{slug}"
		target="_blank"
		rel="noopener noreferrer"
		class="relative aspect-[2/3] w-full overflow-hidden bg-neutral-200 dark:bg-neutral-800"
	>
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

		<!-- Info button -->
		<div class="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
			<Button
				icon={Info}
				size="xs"
				variant="secondary"
				tooltip="Episode details"
				on:click={(e) => {
					e.preventDefault();
					e.stopPropagation();
					openDetail();
				}}
			/>
		</div>
	</a>

	<!-- Content -->
	<div class="flex flex-1 flex-col gap-2 p-3">
		<!-- Profile + Size -->
		<div class="flex items-center justify-between gap-1.5">
			<Tooltip text={series.isProfilarrProfile ? '' : 'Not managed by Profilarr'} position="top">
				<Badge
					variant={series.isProfilarrProfile ? 'accent' : 'warning'}
					icon={series.isProfilarrProfile ? null : CircleAlert}
					mono
				>
					{series.qualityProfileName}
				</Badge>
			</Tooltip>
			{#if series.sizeOnDisk}
				<span class="font-mono text-xs text-neutral-500 dark:text-neutral-400">
					{formatSize(series.sizeOnDisk)}
				</span>
			{/if}
		</div>

		<!-- Episodes progress -->
		<ProgressIndicator
			current={series.episodeFileCount}
			target={series.episodeCount}
			met={series.episodeFileCount === series.episodeCount}
			mode="compact"
		/>
	</div>
</div>

<InfoModal bind:open={detailOpen} header={series.title} size="2xl">
	{#if episodesLoading}
		<div class="flex items-center gap-2 py-4 text-sm text-neutral-500 dark:text-neutral-400">
			<div
				class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-accent-500"
			></div>
			Loading episodes...
		</div>
	{:else if seasonRows.length > 0}
		<div class="episode-table-wrapper w-full">
			<ExpandableTable
				columns={seasonColumns}
				data={seasonRows}
				getRowId={(row) => row.seasonNumber}
				compact
				flushExpanded
				bind:expandedRows={seasonExpandedRows}
			>
				<svelte:fragment slot="cell" let:row let:column>
					{#if column.key === 'label'}
						<span class="font-medium text-neutral-900 dark:text-neutral-100">{row.label}</span>
					{:else if column.key === 'episodes'}
						<span class="font-mono text-xs">
							<span
								class={row.fileCount === row.episodeCount
									? 'text-green-600 dark:text-green-400'
									: 'text-neutral-700 dark:text-neutral-300'}
							>
								{row.fileCount}
							</span>
							<span class="text-neutral-400 dark:text-neutral-500">/ {row.episodeCount}</span>
						</span>
					{/if}
				</svelte:fragment>

				<svelte:fragment slot="expanded" let:row>
					<div class="divide-y divide-neutral-200 overflow-hidden dark:divide-neutral-700/40">
						{#each row.episodes as ep}
							<div class="space-y-2 px-3 py-3">
								<!-- Title + Progress -->
								<div class="flex items-center justify-between gap-2">
									<span class="truncate text-sm text-neutral-900 dark:text-neutral-100">
										{ep.episodeNumber}. {ep.title}
									</span>
									{#if ep.hasFile}
										<div class="flex-shrink-0">
											<ProgressIndicator
												current={ep.customFormatScore}
												target={ep.cutoffScore}
												met={ep.cutoffMet}
												mode="inline"
											/>
										</div>
									{:else}
										<span class="flex-shrink-0 text-xs text-neutral-400 dark:text-neutral-500"
											>Missing</span
										>
									{/if}
								</div>
								<!-- Filename -->
								{#if ep.fileName}
									<div class="font-mono text-xs break-all text-neutral-500 dark:text-neutral-400">
										{ep.fileName}
									</div>
								{/if}
								<!-- Custom Formats -->
								{#if ep.hasFile && ep.scoreBreakdown.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each [...ep.scoreBreakdown].sort((a, b) => b.score - a.score) as item}
											<CustomFormatBadge name={item.name} score={item.score} />
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</svelte:fragment>
			</ExpandableTable>
		</div>
	{:else}
		<span class="text-sm text-neutral-500 dark:text-neutral-400">No episodes found</span>
	{/if}
</InfoModal>

<style>
	.episode-table-wrapper :global(> div) {
		overflow-x: hidden !important;
	}
</style>
