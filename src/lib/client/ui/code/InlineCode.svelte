<script lang="ts">
	import type { ComponentType } from 'svelte';

	export let text: string;
	export let icon: ComponentType | null = null;
	export let radius: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'full';

	const radiusClasses = {
		sm: 'rounded-control-sm',
		md: 'rounded-control-sm',
		lg: 'rounded-card',
		xl: 'rounded-card',
		full: 'rounded-pill'
	};
</script>

<code
	class="inline-flex items-center gap-1.5 {radiusClasses[
		radius
	]} bg-surface-hover px-1 py-px text-[0.85em] text-text-soft"
	style="font-family: var(--font-code)"
>
	{#if icon}
		<svelte:component this={icon} size={12} class="shrink-0 text-text-subtle" />
	{/if}
	{text}
</code>
