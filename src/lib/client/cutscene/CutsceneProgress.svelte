<script lang="ts">
	import { ChevronLeft, ChevronRight, Check } from 'lucide-svelte';

	export let currentStep: number = 0;
	export let totalSteps: number = 0;
	export let onBack: (() => void) | undefined = undefined;
	export let onForward: (() => void) | undefined = undefined;
	export let showBack: boolean = true;

	$: progressPercent = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;
	$: isLastStep = currentStep + 1 === totalSteps;
</script>

<div class="flex flex-col gap-1.5">
	<div class="text-right text-xs text-neutral-400 dark:text-neutral-500">
		{currentStep + 1}/{totalSteps}
	</div>
	<div class="flex h-8 items-stretch">
		{#if showBack}
			<button
				class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-l-lg border border-neutral-300 bg-white text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
				on:click={onBack}
			>
				<ChevronLeft size={14} />
			</button>
		{/if}
		<div
			class="relative flex min-w-[120px] flex-1 items-center overflow-hidden border-y border-neutral-300 bg-neutral-200/50 dark:border-neutral-700/60 dark:bg-neutral-800/30"
			class:border-l={!showBack}
			class:rounded-l-lg={!showBack}
			class:border-r={!onForward}
			class:rounded-r-lg={!onForward}
		>
			<div
				class="absolute inset-y-0 left-0 bg-accent-500 transition-all duration-300"
				style="width: {progressPercent}%"
			></div>
		</div>
		{#if onForward}
			<button
				class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-r-lg border border-l-0 border-neutral-300 bg-white text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
				on:click={onForward}
			>
				{#if isLastStep}
					<Check size={14} class="text-green-500" />
				{:else}
					<ChevronRight size={14} />
				{/if}
			</button>
		{/if}
	</div>
</div>
