<script lang="ts">
	import type { ComponentType } from 'svelte';
	import { createEventDispatcher } from 'svelte';

	export let icon: ComponentType;
	export let title: string;
	export let variant: 'neutral' | 'danger' | 'accent' = 'neutral';
	export let size: 'sm' | 'md' = 'md';
	export let type: 'button' | 'submit' = 'button';
	export let disabled: boolean = false;
	export let stopPropagation: boolean = false;

	const dispatch = createEventDispatcher<{ click: MouseEvent }>();

	const sizeClasses = {
		sm: 'h-6 w-6',
		md: 'h-7 w-7'
	};

	const iconSizes = {
		sm: 12,
		md: 14
	};

	const variantClasses = {
		neutral: 'border-border bg-surface text-text-soft hover:bg-surface-hover',
		danger:
			'border-border bg-surface text-text-soft hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-400',
		accent:
			'border-border bg-surface text-text-soft hover:border-accent-300 hover:bg-accent-50 hover:text-accent-600 dark:hover:border-accent-700 dark:hover:bg-accent-900/20 dark:hover:text-accent-400'
	};

	function handleClick(event: MouseEvent) {
		if (stopPropagation) {
			event.stopPropagation();
		}
		dispatch('click', event);
	}
</script>

<button
	{type}
	{disabled}
	on:click={handleClick}
	class="inline-flex items-center justify-center rounded border transition-colors {sizeClasses[
		size
	]} {variantClasses[variant]} disabled:cursor-not-allowed disabled:opacity-50"
	{title}
>
	<svelte:component this={icon} size={iconSizes[size]} />
</button>
