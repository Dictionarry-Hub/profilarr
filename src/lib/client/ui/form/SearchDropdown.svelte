<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { X } from 'lucide-svelte';
	import { clickOutside } from '$lib/client/utils/clickOutside';
	import FormInput from '$ui/form/FormInput.svelte';
	import Button from '$ui/button/Button.svelte';

	type Option = {
		value: string;
		label: string;
		[key: string]: unknown;
	};

	export let options: Option[] = [];
	export let value: string | null = null;
	export let placeholder: string = 'Search...';
	export let disabled: boolean = false;
	export let fullWidth: boolean = true;
	export let label: string = 'Search';
	export let description: string = '';
	export let name: string = '';
	export let hideLabel: boolean = true;
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let constrainMenuHeight: boolean = true;
	/** Fixed positioning to escape overflow containers */
	export let fixed: boolean = false;

	const dispatch = createEventDispatcher<{ change: string }>();

	let open = false;
	let searchQuery = '';
	let inputElement: HTMLInputElement | HTMLTextAreaElement | null = null;
	let highlightedIndex = -1;
	let containerEl: HTMLElement;
	let dropdownEl: HTMLElement;
	let fixedStyle = '';

	$: selectedOption = options.find((opt) => opt.value === value);
	$: if (!open) {
		searchQuery = selectedOption?.label ?? '';
	}
	$: filteredOptions = options.filter((opt) =>
		opt.label.toLowerCase().includes(searchQuery.toLowerCase())
	);
	$: onlySelectedShown =
		filteredOptions.length === 1 && filteredOptions[0].value === value && options.length > 1;
	$: hasClear = value != null && value !== '';
	$: if (open) {
		if (filteredOptions.length === 0) {
			highlightedIndex = -1;
		} else if (highlightedIndex < 0 || highlightedIndex >= filteredOptions.length) {
			const selectedIndex = selectedOption
				? filteredOptions.findIndex((opt) => opt.value === selectedOption.value)
				: -1;
			highlightedIndex = selectedIndex >= 0 ? selectedIndex : 0;
		}
	} else {
		highlightedIndex = -1;
	}

	function moveHighlight(direction: 1 | -1) {
		if (filteredOptions.length === 0) {
			highlightedIndex = -1;
			return;
		}
		if (highlightedIndex < 0 || highlightedIndex >= filteredOptions.length) {
			highlightedIndex = direction === 1 ? 0 : filteredOptions.length - 1;
			return;
		}
		highlightedIndex =
			(highlightedIndex + direction + filteredOptions.length) % filteredOptions.length;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (disabled) return;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				if (!open) open = true;
				moveHighlight(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				if (!open) open = true;
				moveHighlight(-1);
				break;
			case 'Enter':
				if (open && filteredOptions.length > 0) {
					event.preventDefault();
					const index =
						highlightedIndex >= 0 && highlightedIndex < filteredOptions.length
							? highlightedIndex
							: 0;
					selectOption(filteredOptions[index]);
				}
				break;
			case 'Escape':
				if (open) {
					event.preventDefault();
					close();
				}
				break;
		}
	}

	function handleInput(event: CustomEvent<string>) {
		searchQuery = event.detail;
		open = true;
		highlightedIndex = 0;
	}

	function handleFocus() {
		if (!disabled) {
			open = true;
		}
	}

	function close() {
		open = false;
	}

	function handleBlur() {
		setTimeout(() => {
			open = false;
		}, 100);
	}

	function selectOption(option: Option) {
		searchQuery = option.label;
		dispatch('change', option.value);
		open = false;
		highlightedIndex = -1;
	}

	function clearSelection() {
		searchQuery = '';
		dispatch('change', '');
		open = true;
		highlightedIndex = 0;
		inputElement?.focus();
	}

	function updateFixedPosition() {
		if (!fixed || !containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		fixedStyle = `top: ${rect.bottom + 4}px; left: ${rect.left}px; width: ${rect.width}px;`;
	}

	$: if (fixed && open && containerEl) {
		updateFixedPosition();
	}

	onMount(() => {
		if (fixed) {
			window.addEventListener('scroll', updateFixedPosition, true);
			window.addEventListener('resize', updateFixedPosition);
			return () => {
				window.removeEventListener('scroll', updateFixedPosition, true);
				window.removeEventListener('resize', updateFixedPosition);
			};
		}
		return;
	});
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class="relative"
	use:clickOutside={close}
	class:w-full={fullWidth}
	on:keydown={handleKeyDown}
	bind:this={containerEl}
>
	<FormInput
		{label}
		{description}
		{name}
		{placeholder}
		{disabled}
		{size}
		{hideLabel}
		bind:value={searchQuery}
		bind:inputElement
		on:input={handleInput}
		on:focus={handleFocus}
		on:blur={handleBlur}
	>
		<svelte:fragment slot="suffix">
			{#if hasClear}
				<Button
					icon={X}
					variant="ghost"
					size="xs"
					ariaLabel="Clear selection"
					on:mousedown={(e) => e.preventDefault()}
					on:click={clearSelection}
				/>
			{/if}
		</svelte:fragment>
	</FormInput>

	{#if open}
		<div
			bind:this={dropdownEl}
			role="listbox"
			class="z-50 overflow-y-auto rounded-xl border border-neutral-300 bg-white p-1 shadow-lg dark:border-neutral-700/60 dark:bg-neutral-800 {constrainMenuHeight
				? 'max-h-60'
				: ''} {fixed ? 'fixed' : 'absolute top-full mt-1 w-full'}"
			style={fixed ? fixedStyle : ''}
		>
			{#each filteredOptions as option, index}
				{@const isHighlighted = highlightedIndex === index}
				{@const isSelected = option.value === value}
				<button
					type="button"
					role="option"
					aria-selected={isSelected}
					on:mouseenter={() => (highlightedIndex = index)}
					on:mousedown={() => selectOption(option)}
					class="w-full rounded-xl px-3 py-2 text-left text-sm transition-colors {isHighlighted
						? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-700/40 dark:text-neutral-100'
						: 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800'} {isSelected
						? 'font-medium'
						: ''}"
				>
					<slot name="item" {option}>
						{option.label}
					</slot>
				</button>
			{/each}
			{#if onlySelectedShown}
				<p class="px-3 py-2 text-xs text-neutral-400 dark:text-neutral-500">
					Clear selection to browse all options
				</p>
			{:else if filteredOptions.length === 0}
				<p class="px-3 py-2 text-xs text-neutral-400 dark:text-neutral-500">No matches found</p>
			{/if}
		</div>
	{/if}
</div>
