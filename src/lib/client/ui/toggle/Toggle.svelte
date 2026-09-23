<script context="module" lang="ts">
	let nextId = 0;
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Check } from '@lucide/svelte';
	import Tooltip from '$lib/client/ui/tooltip/Tooltip.svelte';

	type NamedColor = 'accent' | 'amber' | 'green' | 'red' | 'neutral' | 'blue';

	export let checked: boolean = false;
	export let disabled: boolean = false;
	export let label: string = '';
	export let ariaLabel: string = 'Toggle';
	export let color: 'accent' | 'amber' | 'green' | 'red' | 'neutral' = 'accent';
	// Overrides color; accepts a named color, hex (#FFC230), or CSS var (var(--arr-radarr-color))
	export let checkboxColor:
		'accent' | 'blue' | 'green' | 'red' | 'neutral' | `#${string}` | `var(--${string})` | '' = '';
	export let fullWidth: boolean = false;
	export let infoHeader: string = '';
	export let infoBody: string = '';

	const dispatch = createEventDispatcher<{ change: boolean; checked: boolean }>();

	const infoId = `toggle-info-${nextId++}`;

	const checkIconClasses: Record<NamedColor, string> = {
		accent: 'text-accent-600 dark:text-accent-400',
		amber: 'text-amber-600 dark:text-amber-400',
		green: 'text-green-600 dark:text-green-400',
		red: 'text-red-600 dark:text-red-400',
		neutral: 'text-neutral-700 dark:text-neutral-200',
		blue: 'text-blue-600 dark:text-blue-400'
	};

	$: resolvedLabel = label || ariaLabel;
	$: resolvedColor = checkboxColor || color;
	$: isCustomColor = resolvedColor.startsWith('#') || resolvedColor.startsWith('var(');
	$: namedColor = (isCustomColor ? 'accent' : resolvedColor) as NamedColor;
	$: hasInfo = infoHeader.trim() !== '' || infoBody.trim() !== '';

	$: textClass = checked
		? 'text-neutral-900 dark:text-neutral-50'
		: 'text-neutral-600 dark:text-neutral-300';
	$: checkIconClass = isCustomColor ? '' : checkIconClasses[namedColor];
	$: checkIconStyle = isCustomColor ? `color: ${resolvedColor};` : '';

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
	aria-describedby={hasInfo ? infoId : undefined}
	tabindex={disabled ? undefined : 0}
	on:click={handleToggle}
	on:keydown={(event) => {
		if (disabled) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleToggle();
		}
	}}
	class="relative flex {fullWidth
		? 'w-full justify-between'
		: 'w-fit'} items-center rounded-xl border border-neutral-300 bg-white text-sm transition-[background-color,color,transform] duration-150 select-none focus-visible:ring-2 focus-visible:ring-accent-500/50 focus-visible:outline-none dark:border-neutral-700/60 dark:bg-neutral-800/50 {label
		? 'px-3 py-2'
		: 'p-2'} {textClass} {disabled
		? 'cursor-not-allowed opacity-50'
		: 'cursor-pointer hover:bg-neutral-100 active:scale-[0.98] dark:hover:bg-neutral-700'}"
>
	{#if label}
		<span class="min-w-0">{label}</span>
	{/if}
	<span
		class="inline-flex shrink-0 overflow-hidden transition-all duration-150 {checked
			? 'opacity-100'
			: 'opacity-0'} {label ? (checked ? 'ml-1.5 w-4' : 'ml-0 w-0') : 'w-4'}"
		aria-hidden="true"
	>
		<Check size={16} strokeWidth={2.5} class={checkIconClass} style={checkIconStyle} />
	</span>
	{#if hasInfo}
		<!-- Hover overlay that anchors the tooltip to the whole toggle; clicks bubble to the row -->
		<span class="absolute inset-0 flex" aria-hidden="true">
			<Tooltip header={infoHeader} text={infoBody} size="lg" fullWidth>
				<span class="w-full"></span>
			</Tooltip>
		</span>
		<span id={infoId} class="sr-only">{infoBody}</span>
	{/if}
</div>
