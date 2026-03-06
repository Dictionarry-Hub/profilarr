<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ComponentType } from 'svelte';
	import { Check } from 'lucide-svelte';
	import IconCheckbox from '$lib/client/ui/form/IconCheckbox.svelte';

	export let checked: boolean = false;
	export let disabled: boolean = false;
	export let label: string = '';
	export let ariaLabel: string = 'Toggle';
	// Legacy color prop (mapped to IconCheckbox color)
	export let color: 'accent' | 'amber' | 'green' | 'red' | 'neutral' = 'accent';
	// IconCheckbox passthrough props
	export let icon: ComponentType = Check;
	export let checkboxColor:
		| 'accent'
		| 'blue'
		| 'green'
		| 'red'
		| 'neutral'
		| `#${string}`
		| `var(--${string})`
		| '' = '';
	export let shape: 'square' | 'circle' | 'rounded' = 'circle';
	export let variant: 'filled' | 'outline' = 'filled';
	export let iconColor: string = '';

	const dispatch = createEventDispatcher<{ change: boolean; checked: boolean }>();

	$: resolvedLabel = label || ariaLabel;
	$: resolvedCheckboxColor = checkboxColor ? checkboxColor : color === 'amber' ? '#F59E0B' : color;

	function handleToggle() {
		if (disabled) return;
		checked = !checked;
		dispatch('checked', checked);
		dispatch('change', checked);
	}
</script>

<div
	role="switch"
	aria-checked={checked}
	aria-label={resolvedLabel}
	aria-disabled={disabled}
	tabindex={disabled ? undefined : 0}
	on:click={handleToggle}
	on:keydown={(event) => {
		if (disabled) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleToggle();
		}
	}}
	class="flex items-center justify-between gap-3 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 transition-colors dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-200 {disabled
		? 'cursor-not-allowed opacity-50'
		: 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800'}"
>
	{#if label}
		<span class="truncate">{label}</span>
	{/if}
	<IconCheckbox
		{checked}
		{icon}
		color={resolvedCheckboxColor || 'accent'}
		{shape}
		{variant}
		{iconColor}
		{disabled}
		stopPropagation
		on:click={handleToggle}
	/>
</div>
