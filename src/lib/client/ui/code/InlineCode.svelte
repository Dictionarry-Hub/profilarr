<script lang="ts">
	import type { Component } from 'svelte';

	export let text: string;
	export let icon: Component | null = null;
	export let rounded: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'full';
	// 'raised' matches a resting button's background, so the chip stands out on a hovered button
	export let surface: 'default' | 'raised' = 'default';

	const roundedClasses = {
		sm: 'rounded',
		md: 'rounded-md',
		lg: 'rounded-lg',
		xl: 'rounded-xl',
		full: 'rounded-full'
	};

	const surfaceClasses = {
		default: 'bg-neutral-100 dark:bg-neutral-800',
		raised: 'bg-white dark:bg-neutral-800/50'
	};
</script>

<code
	class="inline-flex items-center gap-1.5 {roundedClasses[rounded]} {surfaceClasses[
		surface
	]} px-1 py-px text-[0.85em] text-neutral-700 dark:text-neutral-300"
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
