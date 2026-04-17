<script lang="ts">
	import type { ComponentType } from 'svelte';

	export let text: string;
	export let icon: ComponentType | null = null;
	export let rounded: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'full';

	const roundedClasses = {
		sm: 'rounded',
		md: 'rounded-md',
		lg: 'rounded-lg',
		xl: 'rounded-xl',
		full: 'rounded-full'
	};
</script>

<code
	class="inline-flex items-center gap-1.5 {roundedClasses[
		rounded
	]} bg-neutral-100 px-1 py-px text-[0.85em] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
	style="font-family: var(--font-code)"
>
	{#if icon}
		<svelte:component
			this={icon}
			size={12}
			class="shrink-0 text-neutral-400 dark:text-neutral-500"
		/>
	{/if}
	{text}
</code>
