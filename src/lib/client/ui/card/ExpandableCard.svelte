<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';

	export let title: string;
	export let description: string = '';
	export let open: boolean = true;
	export let onboardingId: string | undefined = undefined;

	function toggle() {
		open = !open;
	}
</script>

<div
	data-onboarding={onboardingId}
	class="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
>
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="flex cursor-pointer items-center justify-between bg-neutral-50 px-6 py-4 dark:bg-neutral-800/50"
		on:click={toggle}
	>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-3">
				<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{title}</h2>
				<slot name="header-right" />
			</div>
			{#if description}
				<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
			{/if}
		</div>
		<ChevronDown
			size={18}
			class="ml-4 shrink-0 text-neutral-400 transition-transform duration-200 {open
				? ''
				: '-rotate-90'}"
		/>
	</div>
	{#if open}
		<div class="border-t border-neutral-200 dark:border-neutral-800">
			<slot />
		</div>
	{/if}
</div>
