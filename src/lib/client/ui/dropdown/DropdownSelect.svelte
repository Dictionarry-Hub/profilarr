<script lang="ts">
	import type { ComponentType } from 'svelte';
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { clickOutside } from '$lib/client/utils/clickOutside';
	import { ChevronDown, ChevronUp } from 'lucide-svelte';
	import Button from '$ui/button/Button.svelte';
	import Dropdown from './Dropdown.svelte';
	import DropdownItem from './DropdownItem.svelte';

	export let label: string | undefined = undefined;
	export let value: string;
	export let options: {
		value: string;
		label: string;
		shortLabel?: string;
		description?: string;
		icon?: ComponentType | { path: string };
	}[];
	export let placeholder: string = 'Select...';
	export let minWidth: string = '8rem';
	export let position: 'left' | 'right' | 'middle' = 'left';
	export let mobilePosition: 'left' | 'right' | 'middle' | null = null;
	export let placement: 'auto' | 'bottom' | 'top' = 'auto';
	// Separate compact controls - compact is shorthand for both
	export let compact: boolean = false;
	export let compactButton: boolean | undefined = undefined;
	export let compactDropdown: boolean | undefined = undefined;
	// Auto-compact dropdown when options exceed this threshold (0 = disabled)
	export let compactDropdownThreshold: number = 0;
	// Responsive: auto-compact button on smaller screens (< 1280px)
	export let responsiveButton: boolean = false;
	export let responsiveDropdown: boolean = false;
	export let mobileDropdownShortLabels: boolean = false;
	export let fullWidth: boolean = false;
	// Fixed positioning to escape overflow containers (e.g. tables)
	export let fixed: boolean = false;
	// Custom width class (overrides fullWidth if set)
	export let width: string | undefined = undefined;
	// Override button content justification
	export let justify: 'center' | 'between' | null = null;
	// Disable the dropdown
	export let disabled: boolean = false;
	// Optional button size override
	export let buttonSize: 'xs' | 'sm' | 'md' | null = null;
	export let showText: boolean = true;
	export let showChevron: boolean = true;

	const dispatch = createEventDispatcher<{ change: string }>();

	let open = false;
	let isSmallScreen = false;
	let mediaQuery: MediaQueryList | null = null;
	let triggerEl: HTMLElement;
	let resolvedPlacement: 'bottom' | 'top' = 'bottom';

	onMount(() => {
		if ((responsiveButton || responsiveDropdown) && typeof window !== 'undefined') {
			mediaQuery = window.matchMedia('(max-width: 1279px)');
			isSmallScreen = mediaQuery.matches;
			mediaQuery.addEventListener('change', handleMediaChange);
		}
	});

	onDestroy(() => {
		if (mediaQuery) {
			mediaQuery.removeEventListener('change', handleMediaChange);
		}
	});

	function handleMediaChange(e: MediaQueryListEvent) {
		isSmallScreen = e.matches;
	}

	$: matchedOption = options.find((o) => o.value === value);
	$: currentIcon = matchedOption?.icon ?? null;
	$: currentLabel = matchedOption?.shortLabel
		? matchedOption.shortLabel
		: matchedOption?.label || placeholder;
	$: buttonText = showText ? currentLabel : '';
	$: isPlaceholder = !matchedOption;
	$: isCompactButton = compactButton ?? (responsiveButton ? isSmallScreen : compact);
	$: isCompactDropdown =
		compactDropdown !== undefined
			? compactDropdown
			: responsiveDropdown && isSmallScreen
				? true
				: compactDropdownThreshold > 0 && options.length >= compactDropdownThreshold
					? true
					: compact;
	$: resolvedButtonSize = buttonSize ?? ((isCompactButton ? 'xs' : 'sm') as 'xs' | 'sm');
	$: resolvedJustify = justify ?? (fullWidth || width || !buttonText ? 'between' : 'center');
	$: chevronIcon = showChevron
		? open && resolvedPlacement === 'top'
			? ChevronUp
			: ChevronDown
		: null;
	$: labelClasses = isCompactButton ? 'text-xs text-text-muted' : 'text-sm text-text-muted';

	function getDropdownLabel(option: { label: string; shortLabel?: string }) {
		return mobileDropdownShortLabels && isSmallScreen
			? (option.shortLabel ?? option.label)
			: option.label;
	}

	function select(optionValue: string) {
		dispatch('change', optionValue);
		open = false;
	}
</script>

<div class="flex items-center gap-2 {width ?? ''}" class:w-full={fullWidth && !width}>
	{#if label}
		<span class={labelClasses}>{label}</span>
	{/if}
	<div
		class="relative"
		class:flex-1={fullWidth}
		bind:this={triggerEl}
		use:clickOutside={() => (open = false)}
	>
		<Button
			text={buttonText}
			icon={chevronIcon}
			iconPosition="right"
			leadingIcon={currentIcon}
			size={resolvedButtonSize}
			{fullWidth}
			{disabled}
			variant={showText ? 'secondary' : 'ghost'}
			justify={resolvedJustify}
			textColor={isPlaceholder ? 'text-text-subtle' : ''}
			on:click={() => !disabled && (open = !open)}
		/>
		{#if open}
			<Dropdown
				{position}
				{mobilePosition}
				{placement}
				{minWidth}
				compact={isCompactDropdown}
				{fixed}
				{triggerEl}
				on:placementchange={(e) => (resolvedPlacement = e.detail)}
			>
				{#each options as option}
					<DropdownItem
						label={getDropdownLabel(option)}
						icon={option.icon}
						selected={value === option.value}
						compact={isCompactDropdown}
						on:click={() => select(option.value)}
					/>
				{/each}
			</Dropdown>
		{/if}
	</div>
</div>
