<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { ChevronUp, ChevronDown, CircleAlert } from '@lucide/svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';

	type CorrectionReason = 'min' | 'max';
	type StepDirection = 'increment' | 'decrement';

	const dispatch = createEventDispatcher<{
		change: number | undefined;
		correction: { inputValue: number; value: number; reason: CorrectionReason };
	}>();

	export let name: string;
	export let id: string = name;
	export let value: number | undefined = undefined;
	export let min: number | undefined = undefined;
	export let max: number | undefined = undefined;
	export let step: number = 1;
	export let maxDecimals: number | undefined = undefined;
	export let emptyStepValue: number | undefined = undefined;
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

	const repeatDelayMs = 350;
	const repeatInitialIntervalMs = 100;
	const repeatMinIntervalMs = 1;
	const repeatRampDurationMs = 5000;
	const ignoreClickResetDelayMs = 100;

	let inputValue = value === undefined || value === null ? '' : String(value);
	let isFocused = false;
	let isSmallScreen = false;
	let mediaQuery: MediaQueryList | null = null;
	let repeatTimeout: ReturnType<typeof setTimeout> | null = null;
	let ignoreClickResetTimeout: ReturnType<typeof setTimeout> | null = null;
	let repeatingDirection: StepDirection | null = null;
	let repeatStartedAt = 0;
	let ignoreNextClick = false;
	let inputMode: 'decimal' | 'numeric' = 'numeric';

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
		clearStepRepeat();
		clearIgnoredClickReset();
	});

	function handleMediaChange(e: MediaQueryListEvent) {
		isSmallScreen = e.matches;
	}

	function getDecimalPlaces(number: number): number {
		if (!Number.isFinite(number)) return 0;
		const text = String(number);
		if (text.includes('e-')) {
			const [, exponent] = text.split('e-');
			return Number(exponent) || 0;
		}
		return text.split('.')[1]?.length ?? 0;
	}

	function normalizeMaxDecimals(value: number | undefined): number | undefined {
		if (value === undefined || !Number.isFinite(value)) return undefined;
		return Math.max(0, Math.floor(value));
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
	$: stepDecimals = getDecimalPlaces(step);
	$: normalizedMaxDecimals = normalizeMaxDecimals(maxDecimals);
	$: effectiveMaxDecimals = normalizedMaxDecimals ?? stepDecimals;
	$: allowDecimals = effectiveMaxDecimals > 0;
	$: inputMode = allowDecimals ? 'decimal' : 'numeric';
	$: draftState = getDraftState(inputValue);
	$: hasInvalidDraft =
		isFocused &&
		(draftState.status === 'invalid' ||
			(draftState.status === 'valid' && isOutsideRange(draftState.value)));
	$: inputStateClass = hasInvalidDraft
		? 'border-red-500 bg-white focus:border-red-500 dark:border-red-500/70 dark:bg-neutral-800/50 dark:focus:border-red-400'
		: 'border-neutral-300 bg-white focus:border-neutral-400 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:focus:border-neutral-600';
	$: canIncrement = max === undefined || value === undefined || value < max;
	$: canDecrement = min === undefined || value === undefined || value > min;
	$: incrementDisabled = disabled || !canIncrement;
	$: decrementDisabled = disabled || !canDecrement;

	$: if (!isFocused) {
		inputValue = formatValue(value);
	}

	function formatValue(nextValue: number | undefined | null): string {
		if (nextValue === undefined || nextValue === null) return '';
		if (normalizedMaxDecimals !== undefined || stepDecimals > 0) {
			return String(roundToDecimals(nextValue, effectiveMaxDecimals));
		}
		return String(nextValue);
	}

	function roundToDecimals(rawValue: number, decimals: number): number {
		if (decimals <= 0) return Math.round(rawValue);
		const factor = 10 ** decimals;
		return Math.round((rawValue + Number.EPSILON) * factor) / factor;
	}

	function normalizeValue(rawValue: number): { value: number; reason: CorrectionReason | undefined } {
		return clampValue(roundToDecimals(rawValue, effectiveMaxDecimals));
	}

	function getDecimalLength(text: string): number {
		const [, decimals = ''] = text.split('.');
		return decimals.length;
	}

	function isEmptyDraft(text: string): boolean {
		return text === '' || text === '-' || text === '.' || text === '-.';
	}

	function isIncompleteDecimal(text: string): boolean {
		return allowDecimals && /^-?\d+\.$/.test(text);
	}

	function isOutsideRange(rawValue: number): boolean {
		return (min !== undefined && rawValue < min) || (max !== undefined && rawValue > max);
	}

	function getDraftState(
		text: string
	): { status: 'empty' | 'partial' | 'invalid' } | { status: 'valid'; value: number } {
		if (text === '') return { status: 'empty' };
		if (isEmptyDraft(text) || isIncompleteDecimal(text)) return { status: 'partial' };

		const pattern = allowDecimals ? /^-?(?:\d+|\d+\.\d+|\.\d+)$/ : /^-?\d+$/;
		if (!pattern.test(text)) return { status: 'invalid' };

		if (allowDecimals && getDecimalLength(text) > effectiveMaxDecimals) {
			return { status: 'invalid' };
		}

		const rawValue = Number(text);
		if (!Number.isFinite(rawValue)) return { status: 'invalid' };
		return { status: 'valid', value: rawValue };
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

	function updateValue(
		newValue: number,
		rawValue: number = newValue,
		reason?: CorrectionReason,
		syncInput = true
	) {
		value = newValue;
		if (syncInput) {
			inputValue = formatValue(newValue);
		}
		onchange?.(newValue);
		dispatch('change', newValue);
		if (reason && rawValue !== newValue) {
			dispatch('correction', { inputValue: rawValue, value: newValue, reason });
		}
	}

	function seedFromEmptyValue(): boolean {
		if (value !== undefined || emptyStepValue === undefined || !Number.isFinite(emptyStepValue)) {
			return false;
		}

		const result = normalizeValue(emptyStepValue);
		updateValue(result.value, emptyStepValue, result.reason);
		return true;
	}

	function increment() {
		if (seedFromEmptyValue()) return;

		const currentValue = value ?? min ?? 0;
		if (max !== undefined && currentValue >= max) {
			onMaxBlocked?.();
			return;
		}
		const result = normalizeValue(currentValue + step);
		updateValue(result.value, currentValue + step, result.reason);
	}

	function decrement() {
		if (seedFromEmptyValue()) return;

		const currentValue = value ?? min ?? 0;
		if (min !== undefined && currentValue <= min) {
			onMinBlocked?.();
			return;
		}
		const result = normalizeValue(currentValue - step);
		updateValue(result.value, currentValue - step, result.reason);
	}

	function canStep(direction: StepDirection): boolean {
		return direction === 'increment' ? !incrementDisabled : !decrementDisabled;
	}

	function stepValue(direction: StepDirection) {
		if (direction === 'increment') {
			increment();
		} else {
			decrement();
		}
	}

	function commitInputValue() {
		if (isEmptyDraft(inputValue)) {
			value = undefined;
			dispatch('change', undefined);
			inputValue = '';
			return;
		}

		if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(inputValue)) {
			inputValue = formatValue(value);
			return;
		}

		const rawValue = Number(inputValue);
		if (!Number.isFinite(rawValue)) {
			inputValue = formatValue(value);
			return;
		}

		const result = normalizeValue(rawValue);
		updateValue(result.value, rawValue, result.reason);
	}

	function commitFocusedValue() {
		if (!isFocused) return;
		isFocused = false;
		commitInputValue();
	}

	function clearIgnoredClickReset() {
		if (ignoreClickResetTimeout) {
			clearTimeout(ignoreClickResetTimeout);
			ignoreClickResetTimeout = null;
		}
	}

	function clearStepRepeat() {
		if (repeatTimeout) {
			clearTimeout(repeatTimeout);
			repeatTimeout = null;
		}
		repeatingDirection = null;
		repeatStartedAt = 0;

		if (typeof window !== 'undefined') {
			window.removeEventListener('pointerup', clearStepRepeat);
			window.removeEventListener('blur', clearStepRepeat);
		}

		if (ignoreNextClick && !ignoreClickResetTimeout) {
			ignoreClickResetTimeout = setTimeout(() => {
				ignoreNextClick = false;
				ignoreClickResetTimeout = null;
			}, ignoreClickResetDelayMs);
		}
	}

	function getRepeatInterval(): number {
		const elapsedMs = Date.now() - repeatStartedAt;
		const progress = Math.min(1, elapsedMs / repeatRampDurationMs);
		const easedProgress = progress * progress * (3 - 2 * progress);
		return Math.round(
			repeatInitialIntervalMs - (repeatInitialIntervalMs - repeatMinIntervalMs) * easedProgress
		);
	}

	function repeatStep() {
		if (!repeatingDirection || !canStep(repeatingDirection)) {
			clearStepRepeat();
			return;
		}

		stepValue(repeatingDirection);
		repeatTimeout = setTimeout(repeatStep, getRepeatInterval());
	}

	function startStepRepeat(direction: StepDirection, event: PointerEvent) {
		if (!canStep(direction)) return;

		clearStepRepeat();
		clearIgnoredClickReset();
		event.preventDefault();
		ignoreNextClick = true;
		commitFocusedValue();
		stepValue(direction);
		repeatingDirection = direction;
		repeatStartedAt = Date.now();

		if (typeof window !== 'undefined') {
			window.addEventListener('pointerup', clearStepRepeat);
			window.addEventListener('blur', clearStepRepeat);
		}

		repeatTimeout = setTimeout(repeatStep, repeatDelayMs);
	}

	function handleStepClick(direction: StepDirection) {
		if (ignoreNextClick) {
			ignoreNextClick = false;
			clearIgnoredClickReset();
			return;
		}

		stepValue(direction);
	}

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		inputValue = target.value;

		const state = getDraftState(inputValue);
		if (state.status !== 'valid' || validateOn === 'blur') return;

		updateValue(state.value, state.value, undefined, false);
	}

	function handleBlur() {
		if (!isFocused) return;
		isFocused = false;
		commitInputValue();
	}

	function handleFocus() {
		isFocused = true;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (disabled || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;

		event.preventDefault();
		if (isFocused) {
			commitInputValue();
			isFocused = true;
		}
		stepValue(event.key === 'ArrowUp' ? 'increment' : 'decrement');
	}
</script>

<div class="relative">
	<input
		type="text"
		{id}
		{name}
		inputmode={inputMode}
		role="spinbutton"
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuenow={value}
		aria-invalid={hasInvalidDraft ? 'true' : undefined}
		bind:value={inputValue}
		oninput={handleInput}
		onfocus={handleFocus}
		onblur={handleBlur}
		onkeydown={handleKeydown}
		{required}
		{disabled}
		{placeholder}
		style={autoWidthStyle}
		class="block {widthClass} border text-neutral-900 placeholder-neutral-400 transition-colors focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 dark:text-neutral-50 dark:placeholder-neutral-500 dark:disabled:bg-neutral-800/40 dark:disabled:text-neutral-500 {inputSizeClasses} {fontClass} {inputStateClass}"
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

	{#if !hideButtons}
		<div class="absolute top-0 right-0 bottom-0 flex flex-col">
			<button
				type="button"
				onclick={() => handleStepClick('increment')}
				onpointerdown={(event) => startStepRepeat('increment', event)}
				onpointerleave={clearStepRepeat}
				disabled={incrementDisabled}
				class="flex flex-1 {buttonWidthClass} cursor-pointer items-center justify-center {buttonTopRadius} border border-neutral-300 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-300 dark:hover:bg-neutral-800"
			>
				<ChevronUp size={iconSize} />
			</button>
			<button
				type="button"
				onclick={() => handleStepClick('decrement')}
				onpointerdown={(event) => startStepRepeat('decrement', event)}
				onpointerleave={clearStepRepeat}
				disabled={decrementDisabled}
				class="flex flex-1 {buttonWidthClass} cursor-pointer items-center justify-center {buttonBottomRadius} border border-t-0 border-neutral-300 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-300 dark:hover:bg-neutral-800"
			>
				<ChevronDown size={iconSize} />
			</button>
		</div>
	{/if}
</div>
