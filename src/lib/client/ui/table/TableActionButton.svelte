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
			'border-border bg-surface text-text-soft hover:border-danger-border hover:bg-danger-bg hover:text-danger-icon ',
		accent:
			'border-border bg-surface text-text-soft hover:border-accent-solid hover:bg-surface-hover hover:text-accent-solid'
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
	class="inline-flex items-center justify-center rounded-control-sm border transition-colors {sizeClasses[
		size
	]} {variantClasses[variant]} disabled:cursor-not-allowed disabled:opacity-50"
	{title}
>
	<svelte:component this={icon} size={iconSizes[size]} />
</button>
