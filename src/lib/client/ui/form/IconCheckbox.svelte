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

	const baseClass = 'flex h-5 w-5 items-center justify-center border transition-colors';
	const uncheckedClass =
		'border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:hover:border-neutral-600 dark:hover:bg-neutral-800';
	const disabledClass = 'cursor-not-allowed opacity-50';
	const enabledClass = 'cursor-pointer focus:outline-none';

	const filledClasses = {
		accent:
			'border-accent-600 bg-accent-600 hover:brightness-110 dark:border-accent-500 dark:bg-accent-500',
		neutral:
			'border-neutral-900 bg-neutral-900 hover:brightness-110 dark:border-neutral-200 dark:bg-neutral-200',
		green:
			'border-green-600 bg-green-600 hover:brightness-110 dark:border-green-500 dark:bg-green-500',
		red: 'border-red-600 bg-red-600 hover:brightness-110 dark:border-red-500 dark:bg-red-500',
		blue: 'border-blue-600 bg-blue-600 hover:brightness-110 dark:border-blue-500 dark:bg-blue-500'
	};

	const outlineClasses = {
		accent:
			'border-accent-600 bg-white hover:bg-neutral-50 dark:border-accent-500 dark:bg-neutral-800/50 dark:hover:bg-neutral-800',
		neutral:
			'border-neutral-400 bg-white hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800/50 dark:hover:bg-neutral-800',
		green:
			'border-green-600 bg-white hover:bg-neutral-50 dark:border-green-500 dark:bg-neutral-800/50 dark:hover:bg-neutral-800',
		red: 'border-red-600 bg-white hover:bg-neutral-50 dark:border-red-500 dark:bg-neutral-800/50 dark:hover:bg-neutral-800',
		blue: 'border-blue-600 bg-white hover:bg-neutral-50 dark:border-blue-500 dark:bg-neutral-800/50 dark:hover:bg-neutral-800'
	};

	const customFilledClass = 'hover:brightness-110';
	const customOutlineClass =
		'bg-white hover:bg-neutral-50 dark:bg-neutral-800/50 dark:hover:bg-neutral-800';

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
		accent: 'text-accent-600 dark:text-accent-400',
		neutral: 'text-neutral-900 dark:text-neutral-100',
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
	style="{buttonStyle}{shape === 'circle' ? ' border-radius: 9999px !important;' : ''}"
	class="{baseClass} {shapeClass} {stateClass} {disabled ? disabledClass : enabledClass}"
>
	{#if checked}
		<svelte:component this={icon} size={14} class={resolvedIconClass} />
	{/if}
</button>
