<script lang="ts">
	import { build } from '$lib/shared/build.ts';
	import { ArrowUp } from 'lucide-svelte';
	import type { VersionStatusInfo } from '$announcements/index.ts';
	import Label from '$ui/label/Label.svelte';

	export let status: VersionStatusInfo | null = null;

	const CHANNEL_LABELS = {
		stable: 'Stable',
		develop: 'Develop',
		dev: 'Unstable'
	} as const;

	$: channelLabel = CHANNEL_LABELS[build.channel];
	$: buildString =
		build.channel === 'stable'
			? `v${build.version}`
			: build.channel === 'develop'
				? build.version
				: null;

	$: kind = status?.status ?? null;
</script>

<div class="flex flex-wrap items-center gap-2">
	<Label variant="secondary" size="md" radius="md" mono>
		{buildString ? `${channelLabel} · ${buildString}` : channelLabel}
	</Label>
	{#if kind === 'up-to-date'}
		<Label variant="success" size="md" radius="md">Up to date</Label>
	{:else if kind === 'out-of-date' && status?.latestVersion}
		<Label
			variant="secondary"
			size="md"
			radius="md"
			href={status.releaseUrl ?? undefined}
			target={status.releaseUrl ? '_blank' : undefined}
			rel={status.releaseUrl ? 'noopener noreferrer' : undefined}
		>
			<ArrowUp class="h-3.5 w-3.5 text-success-icon" />
			Update Available: {status.latestVersion}
		</Label>
	{/if}
</div>
