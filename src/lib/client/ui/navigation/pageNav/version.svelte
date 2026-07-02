<script lang="ts">
	import { page } from '$app/stores';
	import { ArrowUp } from 'lucide-svelte';
	import { getPlatformLabel } from '$shared/utils/version.ts';
	import { build } from '$lib/shared/build.ts';
	import logo from '$assets/logo-512.png';
	import Button from '$ui/button/Button.svelte';
	import Card from '$ui/card/Card.svelte';

	const CHANNEL_LABELS = {
		stable: 'stable',
		develop: 'develop',
		dev: 'unstable'
	} as const;

	const platform = getPlatformLabel();
	const channelLabel = CHANNEL_LABELS[build.channel];

	const buildString =
		build.channel === 'stable'
			? `v${build.version}`
			: build.channel === 'develop'
				? build.version
				: null;

	const line = buildString
		? `${platform} · ${channelLabel} · ${buildString}`
		: `${platform} · ${channelLabel}`;

	$: versionStatus = $page.data.versionStatus ?? null;
	$: outOfDate = versionStatus?.status === 'out-of-date' && versionStatus.latestVersion;
</script>

<Card padding="sm" flush className="mt-2">
	<div class="flex items-center gap-2.5">
		<img src={logo} alt="Profilarr logo" class="h-5 w-5 flex-shrink-0" />

		<div class="flex-1">
			<div class="text-xs font-semibold text-text">profilarr</div>
			<div class="font-mono text-[10px] text-text-muted">{line}</div>
		</div>

		{#if outOfDate}
			<Button
				icon={ArrowUp}
				variant="outline"
				size="md"
				href={versionStatus.releaseUrl ?? undefined}
				target={versionStatus.releaseUrl ? '_blank' : undefined}
				rel={versionStatus.releaseUrl ? 'noopener noreferrer' : undefined}
				iconColor="text-success-icon"
				tooltip="Update Available: {versionStatus.latestVersion}"
				tooltipPosition="right"
			/>
		{/if}
	</div>
</Card>
