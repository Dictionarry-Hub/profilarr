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
	<div class="text-right text-xs text-text-subtle">
		{currentStep + 1}/{totalSteps}
	</div>
	<div class="flex h-8 items-stretch">
		{#if showBack}
			<!-- lint-disable-next-line no-raw-ui -- custom border-radius to integrate with progress bar -->
			<button
				class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-l-card border border-border bg-surface text-text-muted transition-colors hover:bg-surface-hover hover:text-text-soft"
				on:click={onBack}
			>
				<ChevronLeft size={14} />
			</button>
		{/if}
		<div
			class="relative flex min-w-[120px] flex-1 items-center overflow-hidden border-y border-border bg-surface-hover/50"
			class:border-l={!showBack}
			class:rounded-l-card={!showBack}
			class:border-r={!onForward}
			class:rounded-r-card={!onForward}
		>
			<div
				class="absolute inset-y-0 left-0 bg-accent-solid transition-all duration-300"
				style="width: {progressPercent}%"
			></div>
		</div>
		{#if onForward}
			<!-- lint-disable-next-line no-raw-ui -- custom border-radius to integrate with progress bar -->
			<button
				class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-r-card border border-l-0 border-border bg-surface text-text-muted transition-colors hover:bg-surface-hover hover:text-text-soft"
				on:click={onForward}
			>
				{#if isLastStep}
					<Check size={14} class="text-success-icon" />
				{:else}
					<ChevronRight size={14} />
				{/if}
			</button>
		{/if}
	</div>
</div>
