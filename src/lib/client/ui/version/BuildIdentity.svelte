<script lang="ts">
	import { build } from '$lib/shared/build.ts';
	import Label from '$ui/label/Label.svelte';

	/** Shared identity block: channel chip + build chip + optional status chip. */

	export let compact: boolean = false;
	/** Supplied by the About page's server load. Not needed in compact mode. */
	export let status: 'up-to-date' | 'out-of-date' | 'dev-build' | null = null;
	/** Latest stable version string for "Update available: v2.4.0" copy. */
	export let latestVersion: string | null = null;

	const CHANNEL_LABELS = {
		stable: 'Stable',
		develop: 'Develop',
		dev: 'Unstable'
	} as const;

	const CHANNEL_VARIANTS = {
		stable: 'success',
		develop: 'warning',
		dev: 'info'
	} as const;

	$: channelLabel = CHANNEL_LABELS[build.channel];
	$: channelVariant = CHANNEL_VARIANTS[build.channel];

	// Build string: v<semver> for stable, raw SHA for develop. Dev channel
	// omits the build chip entirely (channel chip alone conveys it).
	$: buildString =
		build.channel === 'stable'
			? `v${build.version}`
			: build.channel === 'develop'
				? build.version
				: null;

	type StatusChip = {
		text: string;
		variant: 'success' | 'warning' | 'info';
	};

	function resolveStatus(): StatusChip | null {
		if (!status || status === 'dev-build') return null;
		if (status === 'up-to-date') return { text: 'Up to date', variant: 'success' };
		if (status === 'out-of-date' && build.channel === 'stable' && latestVersion) {
			return { text: `Update available: v${latestVersion}`, variant: 'warning' };
		}
		if (status === 'out-of-date' && build.channel === 'develop') {
			return { text: 'New commit available', variant: 'info' };
		}
		return null;
	}

	$: statusChip = resolveStatus();
</script>

{#if compact}
	<div class="flex items-center gap-1.5">
		<Label variant={channelVariant} size="sm" rounded="md">{channelLabel}</Label>
		{#if buildString}
			<span class="font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
				{buildString}
			</span>
		{/if}
	</div>
{:else}
	<div class="flex flex-wrap items-center gap-2">
		<Label variant={channelVariant} size="md" rounded="md">{channelLabel}</Label>
		{#if buildString}
			<Label variant="secondary" size="md" rounded="md" mono>{buildString}</Label>
		{/if}
		{#if statusChip}
			<Label variant={statusChip.variant} size="md" rounded="md">{statusChip.text}</Label>
		{/if}
	</div>
{/if}
