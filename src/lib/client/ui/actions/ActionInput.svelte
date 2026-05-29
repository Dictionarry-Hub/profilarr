<script lang="ts">
	import type { ComponentType } from 'svelte';

	export let value: string = '';
	export let placeholder: string = '';
	export let disabled: boolean = false;
	export let mono: boolean = false;
	export let icon: ComponentType | null = null;
</script>

<div
	class="relative flex h-10 w-full items-center rounded-control border border-border bg-surface shadow-control transition-colors {disabled
		? 'cursor-not-allowed opacity-50'
		: ''}"
>
	{#if icon}
		<div class="pointer-events-none absolute left-3 flex items-center">
			<svelte:component this={icon} size={18} class="text-text-muted" />
		</div>
	{/if}

	<input
		type="text"
		bind:value
		{placeholder}
		{disabled}
		class="h-full w-full bg-transparent text-sm text-text placeholder-text-subtle outline-none disabled:cursor-not-allowed {mono
			? 'font-mono'
			: ''} {icon ? 'pr-3 pl-10' : 'px-3'}"
	/>
</div>
