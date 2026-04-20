<script lang="ts">
	import { getPlatformLabel } from '$shared/utils/version.ts';
	import { build } from '$lib/shared/build.ts';
	import logo from '$assets/logo-512.png';
	import Card from '$ui/card/Card.svelte';

	const CHANNEL_LABELS = {
		stable: 'Stable',
		develop: 'Develop',
		dev: 'Unstable'
	} as const;

	const platform = getPlatformLabel();
	const channelLabel = CHANNEL_LABELS[build.channel];

	// v<semver> for stable, raw SHA for develop, nothing for dev.
	const buildString =
		build.channel === 'stable'
			? `v${build.version}`
			: build.channel === 'develop'
				? build.version
				: null;

	const line = buildString
		? `${platform} · ${channelLabel} · ${buildString}`
		: `${platform} · ${channelLabel}`;
</script>

<Card padding="sm" flush className="mt-2">
	<div class="flex items-center gap-2.5">
		<img src={logo} alt="Profilarr logo" class="h-5 w-5 flex-shrink-0" />

		<div class="flex-1">
			<div class="text-xs font-semibold text-neutral-900 dark:text-neutral-50">profilarr</div>
			<div class="font-mono text-[10px] text-neutral-600 dark:text-neutral-400">{line}</div>
		</div>
	</div>
</Card>
