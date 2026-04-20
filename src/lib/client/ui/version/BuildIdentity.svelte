<script lang="ts">
	import { build } from '$lib/shared/build.ts';
	import Label from '$ui/label/Label.svelte';

	/**
	 * Single-label build identity. Renders `Channel · build` in mono, coloured
	 * `info` when up to date and `secondary` otherwise (or when no status is
	 * available — e.g. local dev).
	 */

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

	$: variant = status === 'up-to-date' ? 'info' : 'secondary';
</script>

<Label {variant} size="md" rounded="md" mono>
	{buildString ? `${channelLabel} · ${buildString}` : channelLabel}
</Label>
