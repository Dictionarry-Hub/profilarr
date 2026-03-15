<script lang="ts">
	import { getPlatformLabel, getChannelLabel, shouldShowVersion } from '$shared/utils/version.ts';
	import logo from '$assets/logo-512.png';
	import Card from '$ui/card/Card.svelte';

	export let version: string = '';

	const platform = getPlatformLabel();
	const channel = getChannelLabel();
	const showVersion = shouldShowVersion();
</script>

<Card padding="sm" flush className="mt-2">
	<div class="flex items-center gap-2.5">
		<img src={logo} alt="Profilarr logo" class="h-5 w-5 flex-shrink-0" />

		<div class="flex-1">
			<div class="text-xs font-semibold text-neutral-900 dark:text-neutral-50">profilarr</div>
			<div class="font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
				{platform} · {channel}{#if showVersion && version}
					· {version}{/if}
			</div>
		</div>
	</div>
</Card>
