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
	export let shape: 'square' | 'circle' | 'soft' = 'soft';
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
		circle: 'rounded-pill',
		soft: 'rounded-card'
	};

	$: shapeClass = shapeClasses[shape] || shapeClasses.soft;
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
		green: 'border-success-border bg-success-bg hover:brightness-110',
		red: 'border-danger-border bg-danger-bg hover:brightness-110',
		blue: 'border-info-border bg-info-bg hover:brightness-110'
	};

	const outlineClasses = {
		accent: 'border-accent-solid bg-surface hover:bg-surface-hover',
		neutral: 'border-border bg-surface hover:bg-surface-hover',
		green: 'border-success-border bg-surface hover:bg-surface-hover',
		red: 'border-danger-border bg-surface hover:bg-surface-hover',
		blue: 'border-info-border bg-surface hover:bg-surface-hover'
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
		green: 'text-success-icon',
		red: 'text-danger-icon',
		blue: 'text-info-icon'
	};

	$: outlineIconClass = isCustomColor
		? 'text-current'
		: outlineIconClasses[color as keyof typeof outlineIconClasses] || outlineIconClasses.accent;
	$: resolvedIconClass = iconColor || (variant === 'filled' ? 'text-on-accent' : outlineIconClass);

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
