<script lang="ts">
	import { CircleAlert, Tv, Check, Play, Square, Clock } from 'lucide-svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import Label from '$ui/label/Label.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import type { SonarrSeriesItem } from '$utils/arr/types.ts';
	import type { Column } from '$ui/table/types';
	import { formatDate } from '$shared/utils/dates.ts';
	import { dateFormat } from '$lib/client/stores/dateFormat.ts';
	import { serverTimezone } from '$lib/client/stores/timezone.ts';

	export let row: SonarrSeriesItem;
	export let column: Column<SonarrSeriesItem>;

	$: posterUrl = row.images?.find((i) => i.coverType === 'poster')?.remoteUrl;

	function formatSize(bytes: number): string {
		if (!bytes) return '-';
		const gb = bytes / (1024 * 1024 * 1024);
		if (gb >= 1) return `${gb.toFixed(1)} GB`;
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(0)} MB`;
	}

	function fmtDate(isoString?: string): string {
		if (!isoString) return '-';
		return formatDate(isoString, $serverTimezone, $dateFormat, {
			month: 'short',
			day: 'numeric',
			year: '2-digit'
		});
	}
</script>

{#if column.key === 'monitored'}
	<IconCheckbox
		checked={row.monitored}
		icon={Check}
		color={row.monitored ? 'accent' : 'neutral'}
		shape="circle"
	/>
{:else if column.key === 'title'}
	<div class="flex items-center gap-3">
		<div class="h-12 w-8 flex-shrink-0 overflow-hidden rounded-control-sm bg-surface-hover">
			{#if posterUrl}
				<img src={posterUrl} alt="" loading="lazy" class="h-full w-full object-cover" />
			{:else}
				<div class="flex h-full w-full items-center justify-center">
					<Tv size={12} class="text-text-subtle" />
				</div>
			{/if}
		</div>
		<div>
			<div class="font-medium text-text">{row.title}</div>
			{#if row.year}
				<div class="text-xs text-text-muted">{row.year}</div>
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
{:else if column.key === 'episodes'}
	<Badge variant={row.episodeFileCount === row.episodeCount ? 'success' : 'neutral'} mono>
		{row.episodeFileCount}/{row.episodeCount}
	</Badge>
{:else if column.key === 'status'}
	{#if row.status === 'continuing'}
		<Label variant="success" size="sm"><svelte:component this={Play} size={12} /> Continuing</Label>
	{:else if row.status === 'ended'}
		<Label variant="secondary" size="sm"><svelte:component this={Square} size={12} /> Ended</Label>
	{:else if row.status === 'upcoming'}
		<Label variant="info" size="sm"><svelte:component this={Clock} size={12} /> Upcoming</Label>
	{:else}
		<Label variant="secondary" size="sm">{row.status ?? '-'}</Label>
	{/if}
{:else if column.key === 'sizeOnDisk'}
	<span class="font-mono text-xs text-text-soft">{formatSize(row.sizeOnDisk)}</span>
{:else if column.key === 'dateAdded'}
	<span class="font-mono text-xs text-text-soft">{fmtDate(row.dateAdded)}</span>
{/if}
