<script lang="ts">
	import { Check } from 'lucide-svelte';

	export let current: number = 0;
	export let target: number = 0;
	export let met: boolean = false;
	export let mode: 'compact' | 'inline' = 'compact';

	$: progress = target > 0 ? Math.max(0, Math.min(current / target, 1)) : 0;
	$: progressPercent = Math.round(progress * 100);

	function getBarColor(p: number, done: boolean): string {
		if (done) return 'bg-green-500 dark:bg-green-400';
		if (p >= 0.75) return 'bg-green-500 dark:bg-green-400';
		if (p >= 0.5) return 'bg-yellow-500 dark:bg-yellow-400';
		return 'bg-red-500 dark:bg-red-400';
	}

	$: barColor = getBarColor(progress, met);
</script>

{#if mode === 'compact'}
	<!-- Card view: vertical stack -->
	<div class="flex flex-col gap-1">
		<div class="flex items-center justify-between gap-2">
			<span class="font-mono text-xs text-neutral-700 dark:text-neutral-300">
				{current.toLocaleString()}
				<span class="text-neutral-400 dark:text-neutral-500">/ {target.toLocaleString()}</span>
			</span>
			{#if met}
				<Check size={14} class="flex-shrink-0 text-green-600 dark:text-green-400" />
			{:else}
				<span class="font-mono text-xs text-neutral-400 dark:text-neutral-500">
					{progressPercent}%
				</span>
			{/if}
		</div>
		<div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
			<div
				class="h-full rounded-full transition-all {barColor}"
				style="width: {progressPercent}%"
			></div>
		</div>
	</div>
{:else}
	<!-- Table view: horizontal inline -->
	<div class="flex items-center gap-2 whitespace-nowrap">
		<div
			class="h-1.5 w-12 flex-shrink-0 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"
		>
			<div
				class="h-full rounded-full transition-all {barColor}"
				style="width: {progressPercent}%"
			></div>
		</div>
		<span class="font-mono text-xs text-neutral-500 dark:text-neutral-400">
			{current.toLocaleString()} / {target.toLocaleString()}
		</span>
		{#if met}
			<Check size={12} class="flex-shrink-0 text-green-600 dark:text-green-400" />
		{/if}
	</div>
{/if}
