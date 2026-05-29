<script lang="ts">
	import type { ComponentType } from 'svelte';
	import { createEventDispatcher } from 'svelte';

	export let checked: boolean = false;
	export let icon: ComponentType;
	export let color:
		| 'accent'
		| 'blue'
		| 'green'
		| 'red'
		| 'neutral'
		| `#${string}`
		| `var(--${string})` = 'accent'; // accent, semantic colors, hex (#FFC230), or CSS var (var(--arr-radarr-color))
	export let shape: 'square' | 'circle' | 'rounded' = 'rounded';
	export let disabled: boolean = false;
	export let variant: 'filled' | 'outline' = 'filled';
	export let iconColor: string = '';
	export let stopPropagation: boolean = false;
	export let title: string | undefined = undefined;
	export let compact: boolean = false;

	const dispatch = createEventDispatcher<{ click: MouseEvent }>();

	// Shape classes
	const shapeClasses: Record<string, string> = {
		square: 'rounded-none',
		circle: 'rounded-full',
		rounded: 'rounded-lg'
	};

	$: shapeClass = shapeClasses[shape] || shapeClasses.rounded;
	$: isCustomColor = color.startsWith('#') || color.startsWith('var(');
	$: isAccent = color === 'accent';

	$: sizeClass = compact ? 'h-3.5 w-3.5' : 'h-5 w-5';
	$: iconSize = compact ? 9 : 14;
	const baseClass = 'flex items-center justify-center border shadow-control transition-colors';
	const uncheckedClass = 'border-border bg-surface hover:bg-surface-hover';
	const disabledClass = 'cursor-not-allowed opacity-50';
	const enabledClass = 'cursor-pointer focus:outline-none';

	const filledClasses = {
		accent: 'border-accent-solid bg-accent-solid hover:brightness-110',
		neutral: 'border-text bg-text hover:brightness-110',
		green:
			'border-green-600 bg-green-600 hover:brightness-110 dark:border-green-500 dark:bg-green-500',
		red: 'border-red-600 bg-red-600 hover:brightness-110 dark:border-red-500 dark:bg-red-500',
		blue: 'border-blue-600 bg-blue-600 hover:brightness-110 dark:border-blue-500 dark:bg-blue-500'
	};

	const outlineClasses = {
		accent: 'border-accent-solid bg-surface hover:bg-surface-hover',
		neutral: 'border-border bg-surface hover:bg-surface-hover',
		green: 'border-green-600 bg-surface hover:bg-surface-hover dark:border-green-500',
		red: 'border-red-600 bg-surface hover:bg-surface-hover dark:border-red-500',
		blue: 'border-blue-600 bg-surface hover:bg-surface-hover dark:border-blue-500'
	};

	const customFilledClass = 'hover:brightness-110';
	const customOutlineClass = 'bg-surface hover:bg-surface-hover';

	$: resolvedColorKey = isCustomColor ? 'accent' : color;
	$: resolvedFilledClass =
		filledClasses[resolvedColorKey as keyof typeof filledClasses] ?? filledClasses.accent;
	$: resolvedOutlineClass =
		outlineClasses[resolvedColorKey as keyof typeof outlineClasses] ?? outlineClasses.accent;
	$: stateClass = checked
		? variant === 'filled'
			? isCustomColor
				? customFilledClass
				: resolvedFilledClass
			: isCustomColor
				? customOutlineClass
				: resolvedOutlineClass
		: uncheckedClass;
	$: buttonStyle =
		isCustomColor && checked
			? `border-color: ${color}; ${variant === 'filled' ? `background-color: ${color};` : ''} ${variant === 'outline' ? `color: ${color};` : ''}`
			: '';

	const outlineIconClasses = {
		accent: 'text-accent-solid',
		neutral: 'text-text',
		green: 'text-green-600 dark:text-green-400',
		red: 'text-red-600 dark:text-red-400',
		blue: 'text-blue-600 dark:text-blue-400'
	};

	$: outlineIconClass = isCustomColor
		? 'text-current'
		: outlineIconClasses[color as keyof typeof outlineIconClasses] || outlineIconClasses.accent;
	$: resolvedIconClass = iconColor || (variant === 'filled' ? 'text-white' : outlineIconClass);

	function handleClick(event: MouseEvent) {
		if (stopPropagation) {
			event.stopPropagation();
		}
		dispatch('click', event);
	}
</script>

<button
	type="button"
	role="checkbox"
	aria-checked={checked}
	{disabled}
	{title}
	on:click={handleClick}
	style={buttonStyle || undefined}
	class="{baseClass} {sizeClass} {shapeClass} {stateClass} {disabled
		? disabledClass
		: enabledClass}"
>
	{#if checked}
		<svelte:component this={icon} size={iconSize} class={resolvedIconClass} />
	{/if}
</button>

<style>
	:global(.theme-retro) button {
		border-radius: 0 !important;
	}
</style>
