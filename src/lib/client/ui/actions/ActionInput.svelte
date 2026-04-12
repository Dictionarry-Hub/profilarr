<script lang="ts">
	import type { ComponentType } from 'svelte';

	export let value: string = '';
	export let placeholder: string = '';
	export let disabled: boolean = false;
	export let mono: boolean = false;
	export let icon: ComponentType | null = null;
</script>

<div
	class="relative flex h-10 w-full items-center rounded-xl border border-neutral-300 bg-white transition-colors dark:border-neutral-700/60 dark:bg-neutral-800/50 {disabled
		? 'cursor-not-allowed opacity-50'
		: ''}"
>
	{#if icon}
		<div class="pointer-events-none absolute left-3 flex items-center">
			<svelte:component this={icon} size={18} class="text-neutral-500 dark:text-neutral-400" />
		</div>
	{/if}

	<input
		type="text"
		bind:value
		{placeholder}
		{disabled}
		class="h-full w-full bg-transparent text-sm text-neutral-900 placeholder-neutral-400 outline-none disabled:cursor-not-allowed dark:text-neutral-100 dark:placeholder-neutral-500 {mono
			? 'font-mono'
			: ''} {icon ? 'pr-3 pl-10' : 'px-3'}"
	/>
</div>
