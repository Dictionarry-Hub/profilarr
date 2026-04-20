<script lang="ts">
	import { build } from '$lib/shared/build.ts';
	import Label from '$ui/label/Label.svelte';

	/** `channel · build` in mono, plus an "Up to date" chip when applicable. */

	export let status: 'up-to-date' | 'out-of-date' | 'dev-build' | null = null;

	const CHANNEL_LABELS = {
		stable: 'Stable',
		develop: 'Develop',
		dev: 'Unstable'
	} as const;

	// v<semver> for stable, raw SHA for develop, nothing for dev.
	$: channelLabel = CHANNEL_LABELS[build.channel];
	$: buildString =
		build.channel === 'stable'
			? `v${build.version}`
			: build.channel === 'develop'
				? build.version
				: null;

	$: upToDate = status === 'up-to-date';
</script>

<div class="flex flex-wrap items-center gap-2">
	<Label variant="secondary" size="md" rounded="md" mono>
		{buildString ? `${channelLabel} · ${buildString}` : channelLabel}
	</Label>
	{#if upToDate}
		<Label variant="success" size="md" rounded="md">Up to date</Label>
	{/if}
</div>
