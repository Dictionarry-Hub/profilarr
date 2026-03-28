<script lang="ts">
	import {
		Film,
		Check,
		CircleAlert,
		Info,
		CheckCircle,
		Megaphone,
		Clapperboard,
		Flame,
		Users,
		Clock,
		Calendar,
		Star
	} from 'lucide-svelte';
	import Label from '$ui/label/Label.svelte';
	import Button from '$ui/button/Button.svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import CustomFormatBadge from '$ui/arr/CustomFormatBadge.svelte';
	import ProgressIndicator from '$ui/arr/ProgressIndicator.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import type { RadarrLibraryItem } from '$utils/arr/types.ts';

	export let movie: RadarrLibraryItem;
	export let baseUrl: string = '';
	export let visibleFields: Set<string> = new Set();

	$: posterUrl = movie.images?.find((i) => i.coverType === 'poster')?.remoteUrl;

	let detailOpen = false;

	function formatSize(bytes: number | undefined): string {
		if (!bytes) return '';
		const gb = bytes / (1024 * 1024 * 1024);
		if (gb >= 1) return `${gb.toFixed(1)} GB`;
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(0)} MB`;
	}
</script>

<div
	class="group flex flex-col overflow-hidden rounded-xl border border-neutral-300 bg-neutral-50 transition-colors dark:border-neutral-700/60 dark:bg-neutral-900"
>
	<!-- Poster -->
	<a
		href="{baseUrl}/movie/{movie.tmdbId}"
		target="_blank"
		rel="noopener noreferrer"
		class="relative aspect-[2/3] w-full overflow-hidden bg-neutral-200 dark:bg-neutral-800"
	>
		{#if posterUrl}
			<img src={posterUrl} alt={movie.title} loading="lazy" class="h-full w-full object-cover" />
		{:else}
			<div class="flex h-full w-full items-center justify-center">
				<Film class="h-12 w-12 text-neutral-400 dark:text-neutral-600" />
			</div>
		{/if}

		<!-- Monitored indicator -->
		{#if visibleFields.has('monitored')}
			<div class="absolute top-2 left-2">
				<IconCheckbox
					checked={movie.monitored}
					icon={Check}
					color={movie.monitored ? 'green' : 'neutral'}
					shape="circle"
				/>
			</div>
		{/if}

		<!-- Info button -->
		{#if movie.hasFile}
			<div class="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
				<Button
					icon={Info}
					size="xs"
					variant="secondary"
					tooltip="File details"
					on:click={(e) => {
						e.preventDefault();
						e.stopPropagation();
						detailOpen = true;
					}}
				/>
			</div>
		{/if}
	</a>

	<!-- Content -->
	<div class="flex flex-1 flex-col gap-2 p-3">
		{#if visibleFields.has('title')}
			<h3
				class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100"
				title={movie.title}
			>
				{movie.title}
			</h3>
		{/if}
		{#if visibleFields.has('year') && movie.year}
			<span class="text-xs text-neutral-500 dark:text-neutral-400">{movie.year}</span>
		{/if}
		{#if visibleFields.has('profile') || visibleFields.has('size')}
			<div class="flex items-center justify-between gap-1.5">
				{#if visibleFields.has('profile')}
					<Tooltip text={movie.isProfilarrProfile ? '' : 'Not managed by Profilarr'} position="top">
						<Badge
							variant={movie.isProfilarrProfile ? 'accent' : 'warning'}
							icon={movie.isProfilarrProfile ? null : CircleAlert}
							mono
						>
							{movie.qualityProfileName}
						</Badge>
					</Tooltip>
				{/if}
				{#if visibleFields.has('size') && movie.hasFile && movie.sizeOnDisk}
					<span class="font-mono text-xs text-neutral-500 dark:text-neutral-400"
						>{formatSize(movie.sizeOnDisk)}</span
					>
				{/if}
			</div>
		{/if}

		{#if visibleFields.has('status') && movie.status}
			{#if movie.status === 'released'}
				<Label variant="success" size="sm"
					><svelte:component this={CheckCircle} size={12} /> Released</Label
				>
			{:else if movie.status === 'inCinemas'}
				<Label variant="warning" size="sm"
					><svelte:component this={Clapperboard} size={12} /> In Cinemas</Label
				>
			{:else if movie.status === 'announced'}
				<Label variant="info" size="sm"
					><svelte:component this={Megaphone} size={12} /> Announced</Label
				>
			{:else}
				<Label variant="secondary" size="sm">{movie.status}</Label>
			{/if}
		{/if}
		{#if visibleFields.has('quality') && movie.hasFile && movie.qualityName}
			<Badge variant="neutral" mono>{movie.qualityName}</Badge>
		{/if}

		{#if visibleFields.has('releaseGroup') && movie.hasFile && movie.releaseGroup}
			<span class="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
				<Users size={12} />
				<span class="truncate font-mono">{movie.releaseGroup}</span>
			</span>
		{/if}
		{#if visibleFields.has('score') && movie.hasFile}
			<ProgressIndicator
				current={movie.customFormatScore}
				target={movie.cutoffScore}
				met={movie.cutoffMet}
				mode="compact"
			/>
		{/if}
		{#if visibleFields.has('popularity') && movie.popularity}
			<span class="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
				<Flame size={12} />
				<span class="font-mono">{movie.popularity.toFixed(1)}</span>
			</span>
		{/if}
		{#if visibleFields.has('runtime') && movie.runtime}
			<span class="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
				<Clock size={12} />
				{movie.runtime} min
			</span>
		{/if}
		{#if visibleFields.has('rating') && movie.ratings}
			<div class="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
				{#if movie.ratings.imdb}
					<span class="flex items-center gap-1">
						<Star size={12} class="text-yellow-500" />
						<span class="font-mono">{movie.ratings.imdb.value}</span>
					</span>
				{/if}
				{#if movie.ratings.tmdb}
					<span class="flex items-center gap-1">
						<Star size={12} class="text-blue-500" />
						<span class="font-mono">{movie.ratings.tmdb.value}</span>
					</span>
				{/if}
			</div>
		{/if}
		{#if visibleFields.has('dateAdded') && movie.dateAdded}
			<span class="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
				<Calendar size={12} />
				<span class="font-mono"
					>{new Date(movie.dateAdded).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: '2-digit'
					})}</span
				>
			</span>
		{/if}
	</div>
</div>

<InfoModal bind:open={detailOpen} header={movie.title} size="xl">
	<div class="space-y-4">
		{#if movie.fileName}
			<div>
				<div class="mb-1 text-xs font-medium text-neutral-900 dark:text-neutral-100">File</div>
				<code class="block font-mono text-xs break-all text-neutral-600 dark:text-neutral-400">
					{movie.fileName}
				</code>
			</div>
		{/if}

		<div>
			<div class="mb-1.5 text-xs font-medium text-neutral-900 dark:text-neutral-100">
				Custom Formats
			</div>
			{#if movie.scoreBreakdown.length > 0}
				<div class="flex flex-wrap gap-1.5">
					{#each [...movie.scoreBreakdown].sort((a, b) => b.score - a.score) as item}
						<CustomFormatBadge name={item.name} score={item.score} />
					{/each}
				</div>
			{:else}
				<span class="text-xs text-neutral-500 dark:text-neutral-400">No custom formats matched</span
				>
			{/if}
		</div>
	</div>
</InfoModal>
