<script lang="ts">
	import type { ComponentType } from 'svelte';
	import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
	import { ChevronDown } from 'lucide-svelte';
	import { clickOutside } from '$lib/client/utils/clickOutside';
	import Button from '$ui/button/Button.svelte';
	import Dropdown from './Dropdown.svelte';
	import DropdownItem from './DropdownItem.svelte';

	type Option = {
		value: string;
		label: string;
		shortLabel?: string;
		icon?: ComponentType | { path: string };
	};

	export let label: string | undefined = undefined;
	export let value: string | null = null;
	export let options: Option[] = [];
	export let placeholder: string = 'Select...';
	export let limit: number | null = null;
	export let minWidth: string = '12rem';
	export let position: 'left' | 'right' | 'middle' = 'left';
	export let mobilePosition: 'left' | 'right' | 'middle' | null = null;
	export let compact: boolean = false;
	export let compactButton: boolean | undefined = undefined;
	export let compactDropdown: boolean | undefined = undefined;
	export let compactDropdownThreshold: number = 0;
	export let responsiveButton: boolean = false;
	export let responsiveDropdown: boolean = false;
	export let fullWidth: boolean = false;
	export let fixed: boolean = false;
	export let width: string | undefined = undefined;
	export let justify: 'center' | 'between' | null = null;
	export let disabled: boolean = false;
	export let buttonSize: 'xs' | 'sm' | 'md' | null = null;

	const dispatch = createEventDispatcher<{ change: string }>();

	let open = false;
	let inputValue = '';
	let query = '';
	let inputEl: HTMLInputElement | null = null;
	let triggerEl: HTMLElement;
	let highlightedIndex = -1;
	let isSmallScreen = false;
	let mediaQuery: MediaQueryList | null = null;
	let triggerWidth = 0;

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

	$: matchedOption = options.find((o) => o.value === value) ?? null;
	$: currentIcon = matchedOption?.icon ?? null;
	$: currentLabel = matchedOption?.shortLabel
		? matchedOption.shortLabel
		: (matchedOption?.label ?? placeholder);
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
	$: resolvedJustify = justify ?? 'between';
	$: useSelectMode = isSmallScreen && (responsiveButton || responsiveDropdown);

	$: trimmedQuery = query.trim();
	$: filteredOptions = !open
		? options
		: trimmedQuery
			? options.filter((o) => o.label.toLowerCase().includes(trimmedQuery.toLowerCase()))
			: options;

	// Approximate row height for the visible-rows cap. DropdownItem at default
	// (non-compact) sizing is gap-3 px-3 py-2 with text-sm = ~2.25rem per row.
	$: maxHeightStyle = limit != null ? `max-height: calc(${limit} * 2.25rem)` : '';

	$: if (open) {
		if (filteredOptions.length === 0) {
			highlightedIndex = -1;
		} else if (highlightedIndex < 0 || highlightedIndex >= filteredOptions.length) {
			highlightedIndex = 0;
		}
	}

	$: labelClasses = isCompactButton
		? 'text-xs text-neutral-500 dark:text-neutral-400'
		: 'text-sm text-neutral-500 dark:text-neutral-400';

	$: triggerShellClasses = isCompactButton
		? 'gap-1 rounded-lg px-2 py-1 text-xs'
		: 'gap-1.5 rounded-xl px-3 py-1.5 text-sm md:py-2';

	$: chevronSize = isCompactButton ? 12 : 14;

	async function openCombobox() {
		if (disabled || open) return;
		triggerWidth = triggerEl?.getBoundingClientRect().width ?? 0;
		open = true;
		inputValue = matchedOption ? currentLabel : '';
		query = '';
		highlightedIndex = options.length > 0 ? 0 : -1;
		if (useSelectMode) return;
		await tick();
		inputEl?.focus();
		if (inputEl) {
			const end = inputEl.value.length;
			inputEl.setSelectionRange(end, end);
		}
	}

	function toggleCombobox() {
		if (useSelectMode && open) {
			closeCombobox();
			return;
		}
		openCombobox();
	}

	function closeCombobox() {
		open = false;
		inputValue = '';
		query = '';
		highlightedIndex = -1;
	}

	function selectOption(option: Option) {
		value = option.value;
		inputValue = option.label;
		dispatch('change', option.value);
		closeCombobox();
	}

	function handleInput() {
		query = inputValue;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!open) return;
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				if (filteredOptions.length === 0) {
					highlightedIndex = -1;
				} else if (highlightedIndex < 0) {
					highlightedIndex = 0;
				} else {
					highlightedIndex = (highlightedIndex + 1) % filteredOptions.length;
				}
				break;
			case 'ArrowUp':
				e.preventDefault();
				if (filteredOptions.length === 0) {
					highlightedIndex = -1;
				} else if (highlightedIndex < 0) {
					highlightedIndex = filteredOptions.length - 1;
				} else {
					highlightedIndex =
						(highlightedIndex - 1 + filteredOptions.length) % filteredOptions.length;
				}
				break;
			case 'Enter':
				if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
					e.preventDefault();
					selectOption(filteredOptions[highlightedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				closeCombobox();
				break;
		}
	}
</script>

<div class="flex items-center gap-2 {width ?? ''}" class:w-full={fullWidth && !width}>
	{#if label}
		<span class={labelClasses}>{label}</span>
	{/if}
	<div
		class="relative"
		class:flex-1={fullWidth}
		style="min-width: {minWidth}"
		bind:this={triggerEl}
		use:clickOutside={closeCombobox}
	>
		{#if open && !useSelectMode}
			<div
				class="flex w-full items-center {triggerShellClasses} {resolvedJustify === 'between'
					? 'justify-between'
					: 'justify-center'} border border-neutral-300 bg-white font-medium text-neutral-700 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-200"
				style={triggerWidth ? `width: ${triggerWidth}px` : undefined}
			>
				<input
					bind:this={inputEl}
					bind:value={inputValue}
					{placeholder}
					{disabled}
					size="1"
					class="min-w-0 flex-1 bg-transparent font-medium text-neutral-700 outline-none placeholder:text-neutral-400 dark:text-neutral-200 dark:placeholder:text-neutral-500"
					on:input={handleInput}
					on:keydown={handleKeyDown}
				/>
				<ChevronDown size={chevronSize} class="shrink-0 text-neutral-500 dark:text-neutral-400" />
			</div>
		{:else}
			<Button
				text={currentLabel}
				icon={ChevronDown}
				iconPosition="right"
				leadingIcon={currentIcon}
				size={resolvedButtonSize}
				fullWidth={true}
				{disabled}
				justify={resolvedJustify}
				textColor={isPlaceholder ? 'text-neutral-400 dark:text-neutral-500' : ''}
				on:click={toggleCombobox}
			/>
		{/if}
		{#if open}
			<Dropdown
				{position}
				{mobilePosition}
				{minWidth}
				compact={isCompactDropdown}
				{fixed}
				{triggerEl}
			>
				<div class="overflow-y-auto" style={maxHeightStyle}>
					{#each filteredOptions as option, i (option.value)}
						<DropdownItem
							label={option.label}
							icon={option.icon}
							selected={value === option.value}
							compact={isCompactDropdown}
							on:click={() => selectOption(option)}
						/>
					{/each}
					{#if filteredOptions.length === 0}
						<div
							class="text-neutral-400 dark:text-neutral-500 {isCompactDropdown
								? 'px-2 py-1 text-xs'
								: 'px-3 py-2 text-xs'}"
						>
							No matches found
						</div>
					{/if}
				</div>
			</Dropdown>
		{/if}
	</div>
</div>
