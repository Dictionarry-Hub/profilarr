<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { ChevronUp, ChevronDown, CircleAlert } from 'lucide-svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';

	type CorrectionReason = 'min' | 'max';

	const dispatch = createEventDispatcher<{
		change: number | undefined;
		correction: { inputValue: number; value: number; reason: CorrectionReason };
	}>();

	// Props
	export let name: string;
	export let id: string = name;
	export let value: number | undefined = undefined;
	export let min: number | undefined = undefined;
	export let max: number | undefined = undefined;
	export let step: number = 1;
	export let required: boolean = false;
	export let disabled: boolean = false;
	export let warningTooltip: string = '';
	export let placeholder: string = '';
	export let font: 'mono' | 'sans' | undefined = undefined;
	export let compact: boolean = false;
	export let validateOn: 'input' | 'blur' = 'input';
	// Responsive: auto-switch to compact on smaller screens (< 1280px)
	export let responsive: boolean = false;
	export let autoWidth: boolean = false;
	export let onchange: ((value: number) => void) | undefined = undefined;
	export let onMinBlocked: (() => void) | undefined = undefined;
	export let onMaxBlocked: (() => void) | undefined = undefined;

	let inputValue = value === undefined || value === null ? '' : String(value);
	let isFocused = false;
	let isSmallScreen = false;
	let mediaQuery: MediaQueryList | null = null;

	onMount(() => {
		if (responsive && typeof window !== 'undefined') {
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

	$: isCompact = compact || (responsive && isSmallScreen);
	$: hideButtons = responsive && isSmallScreen;
	$: effectiveAutoWidth = autoWidth && (!responsive || isSmallScreen);
	$: fontClass = font === 'mono' ? 'font-mono' : font === 'sans' ? 'font-sans' : '';
	$: warningPaddingClass = warningTooltip
		? isCompact && hideButtons
			? 'pr-7'
			: 'pr-16'
		: isCompact && hideButtons
			? 'pr-2'
			: isCompact
				? 'pr-7'
				: 'pr-10';
	$: inputSizeClasses = isCompact
		? hideButtons
			? `rounded-lg py-1 pl-2 text-xs ${warningPaddingClass}`
			: `rounded-lg px-2 py-1 text-xs ${warningPaddingClass}`
		: `rounded-xl py-2 pl-3 text-sm ${warningPaddingClass}`;
	$: buttonWidthClass = isCompact ? 'w-4' : 'w-6';
	$: iconSize = isCompact ? 10 : 12;
	$: warningRightClass =
		warningTooltip && !hideButtons ? (isCompact ? 'right-6' : 'right-8') : 'right-2';
	$: buttonTopRadius = isCompact
		? 'rounded-tr-lg rounded-tl-none rounded-br-none rounded-bl-none'
		: 'rounded-tr-xl rounded-tl-none rounded-br-none rounded-bl-none';
	$: buttonBottomRadius = isCompact
		? 'rounded-br-lg rounded-bl-none rounded-tr-none rounded-tl-none'
		: 'rounded-br-xl rounded-bl-none rounded-tr-none rounded-tl-none';
	$: widthClass = effectiveAutoWidth ? 'w-auto' : 'w-full';
	$: autoWidthPadding = isCompact ? '1.75rem' : '4rem';
	$: autoWidthCharacters = Math.max(inputValue.length, placeholder.length, 1);
	$: autoWidthStyle = effectiveAutoWidth
		? `width: calc(${autoWidthCharacters}ch + ${autoWidthPadding});`
		: undefined;
	$: canIncrement = max === undefined || value === undefined || value < max;
	$: canDecrement = min === undefined || value === undefined || value > min;
	$: incrementDisabled = disabled || !canIncrement;
	$: decrementDisabled = disabled || !canDecrement;

	$: if (!isFocused) {
		inputValue = value === undefined || value === null ? '' : String(value);
	}

	function clampValue(rawValue: number): { value: number; reason: CorrectionReason | undefined } {
		let newValue = rawValue;
		let reason: CorrectionReason | undefined = undefined;

		if (min !== undefined && newValue < min) {
			newValue = min;
			reason = 'min';
		}

		if (max !== undefined && newValue > max) {
			newValue = max;
			reason = 'max';
		}

		return { value: newValue, reason };
	}

	function updateValue(newValue: number, rawValue: number = newValue, reason?: CorrectionReason) {
		value = newValue;
		inputValue = String(newValue);
		onchange?.(newValue);
		dispatch('change', newValue);
		if (reason && rawValue !== newValue) {
			dispatch('correction', { inputValue: rawValue, value: newValue, reason });
		}
	}

	// Increment/decrement handlers
	function increment() {
		const currentValue = value ?? min ?? 0;
		if (max !== undefined && currentValue >= max) {
			onMaxBlocked?.();
			return;
		}
		updateValue(currentValue + step);
	}

	function decrement() {
		const currentValue = value ?? min ?? 0;
		if (min !== undefined && currentValue <= min) {
			onMinBlocked?.();
			return;
		}
		updateValue(currentValue - step);
	}

	// Validate on input
	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;

		inputValue = target.value;

		// Allow partial input states (e.g., "-", ".", "-.")
		if (inputValue === '' || inputValue === '-' || inputValue === '.' || inputValue === '-.') {
			return;
		}

		const rawValue = Number(inputValue);

		if (Number.isNaN(rawValue)) {
			return;
		}

		if (validateOn === 'blur') {
			return;
		}

		const result = clampValue(rawValue);
		updateValue(result.value, rawValue, result.reason);
	}

	function handleBlur() {
		isFocused = false;
		if (inputValue === '' || inputValue === '-' || inputValue === '.' || inputValue === '-.') {
			value = undefined;
			dispatch('change', undefined);
			inputValue = '';
			return;
		}

		const rawValue = Number(inputValue);
		if (Number.isNaN(rawValue)) {
			inputValue = value === undefined || value === null ? '' : String(value);
			return;
		}

		const result = clampValue(rawValue);
		updateValue(result.value, rawValue, result.reason);
	}

	function handleFocus() {
		isFocused = true;
	}
</script>

<div class="relative">
	<input
		type="number"
		{id}
		{name}
		bind:value={inputValue}
		on:input={handleInput}
		on:focus={handleFocus}
		on:blur={handleBlur}
		{min}
		{max}
		{step}
		{required}
		{disabled}
		{placeholder}
		style={autoWidthStyle}
		class="block {widthClass} [appearance:textfield] border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-50 dark:placeholder-neutral-500 dark:focus:border-neutral-600 dark:disabled:bg-neutral-800/40 dark:disabled:text-neutral-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none {inputSizeClasses} {fontClass}"
	/>

	{#if warningTooltip}
		<div class="absolute top-1/2 z-10 -translate-y-1/2 {warningRightClass}">
			<Tooltip text={warningTooltip} position="top">
				<span class="inline-flex items-center text-red-600 dark:text-red-400">
					<CircleAlert size={isCompact ? 12 : 14} />
				</span>
			</Tooltip>
		</div>
	{/if}

	<!-- Custom increment/decrement buttons (hidden on mobile when responsive) -->
	{#if !hideButtons}
		<div class="absolute top-0 right-0 bottom-0 flex flex-col">
			<button
				type="button"
				on:click={increment}
				disabled={incrementDisabled}
				class="flex flex-1 {buttonWidthClass} items-center justify-center {buttonTopRadius} border border-neutral-300 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-300 dark:hover:bg-neutral-800"
			>
				<ChevronUp size={iconSize} />
			</button>
			<button
				type="button"
				on:click={decrement}
				disabled={decrementDisabled}
				class="flex flex-1 {buttonWidthClass} items-center justify-center {buttonBottomRadius} border border-t-0 border-neutral-300 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-300 dark:hover:bg-neutral-800"
			>
				<ChevronDown size={iconSize} />
			</button>
		</div>
	{/if}
</div>
