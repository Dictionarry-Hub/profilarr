<script lang="ts">
	import { getPlatformLabel, getChannelLabel, shouldShowVersion } from '$shared/utils/version.ts';
	import logo from '$assets/logo-512.png';

	export let version: string = '';

	const platform = getPlatformLabel();
	const channel = getChannelLabel();
	const showVersion = shouldShowVersion();
</script>

<div
	class="mt-2 flex items-center gap-2.5 rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700"
>
	<img src={logo} alt="Profilarr logo" class="h-5 w-5 flex-shrink-0" />

	<div class="flex-1">
		<div class="text-xs font-semibold text-neutral-900 dark:text-neutral-50">profilarr</div>
		<div class="font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
			{platform} · {channel}{#if showVersion && version}
				· {version}{/if}
		</div>
	</div>
</div>
