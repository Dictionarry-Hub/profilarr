<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { Filter } from 'lucide-svelte';
	import FilterTagComponent from './FilterTag.svelte';
	import Label from '$ui/label/Label.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import type { FilterFieldDef, FilterTag, SerializedFilterTag } from './types';

	export let fields: FilterFieldDef[] = [];
	export let items: any[] = [];
	export let tags: FilterTag[] = [];
	export let storageKey: string = '';
	export let placeholder: string = 'Filter...';
	export let onchange: ((tags: FilterTag[]) => void) | undefined = undefined;

	let inputValue = '';
	let valueInputValue = '';
	let inputEl: HTMLInputElement;
	let valueInputEl: HTMLInputElement;
	let containerEl: HTMLElement;
	let highlightedIndex = -1;
	let dropdownOpen = false;
	let activeFieldDef: FilterFieldDef | null = null;

	// ======================================================================
	// Persistence
	// ======================================================================

	function loadTags(): FilterTag[] {
		if (!browser || !storageKey) return [];
		try {
			const stored = localStorage.getItem(storageKey);
			if (stored) {
				const parsed: SerializedFilterTag[] = JSON.parse(stored);
				return parsed.map((t) => ({ ...t, id: crypto.randomUUID() }));
			}
		} catch {}
		return [];
	}

	function saveTags(t: FilterTag[]) {
		if (!browser || !storageKey) return;
		const serialized: SerializedFilterTag[] = t.map(({ id, ...rest }) => rest);
		localStorage.setItem(storageKey, JSON.stringify(serialized));
	}

	onMount(() => {
		const loaded = loadTags();
		if (loaded.length > 0) {
			tags = loaded;
			onchange?.(tags);
		}
	});

	$: saveTags(tags);

	// ======================================================================
	// Field lookup helpers
	// ======================================================================

	$: fieldMap = new Map(fields.map((f) => [f.key, f]));
	$: defaultField = fields.find((f) => f.isDefault) ?? fields[0];

	// ======================================================================
	// Autocomplete phase detection
	// ======================================================================

	type Phase = 'idle' | 'field' | 'value';

	let isFocused = false;

	$: phase = ((): Phase => {
		if (activeFieldDef) return 'value';
		if (inputValue.trim() || isFocused) return 'field';
		return 'idle';
	})();

	// ======================================================================
	// Suggestions
	// ======================================================================

	$: fieldSuggestions = (() => {
		if (phase !== 'field') return [];
		const q = inputValue.trim().toLowerCase();
		if (!q) return fields.map((f) => ({ key: f.key, label: f.label, type: f.type }));
		return fields
			.filter((f) => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q))
			.map((f) => ({ key: f.key, label: f.label, type: f.type }));
	})();

	$: valueSuggestions = (() => {
		if (phase !== 'value' || !activeFieldDef) return [];
		if (activeFieldDef.type === 'number') return [];
		const allSuggestions = activeFieldDef.suggestions?.(items) ?? [];
		if (!valueInputValue) return allSuggestions.slice(0, 5);
		const q = valueInputValue.toLowerCase();
		return allSuggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 5);
	})();

	$: suggestions =
		phase === 'field'
			? fieldSuggestions.map((f) => ({ label: f.label, hint: f.type, value: f.key }))
			: phase === 'value'
				? valueSuggestions.map((s) => ({ label: s, hint: '', value: s }))
				: [];

	$: showNumberHint = phase === 'value' && activeFieldDef?.type === 'number';

	// Reset highlight when suggestions change
	$: (suggestions, (highlightedIndex = -1));

	$: if (suggestions.length > 0 || showNumberHint) {
		dropdownOpen = true;
	}

	// ======================================================================
	// Tag management
	// ======================================================================

	function updateTags(newTags: FilterTag[]) {
		tags = newTags;
		onchange?.(newTags);
	}

	function addTag(field: string, value: string) {
		const trimmed = value.trim();
		if (!trimmed) return;
		updateTags([...tags, { id: crypto.randomUUID(), field, value: trimmed, negated: false }]);
		inputValue = '';
		valueInputValue = '';
		activeFieldDef = null;
		dropdownOpen = true;
		// Re-focus the main input
		requestAnimationFrame(() => inputEl?.focus());
	}

	function selectField(field: FilterFieldDef) {
		activeFieldDef = field;
		inputValue = '';
		valueInputValue = '';
		highlightedIndex = -1;
		dropdownOpen = true;
		requestAnimationFrame(() => valueInputEl?.focus());
	}

	function clearActiveField() {
		activeFieldDef = null;
		valueInputValue = '';
		highlightedIndex = -1;
		requestAnimationFrame(() => inputEl?.focus());
	}

	function removeTag(index: number) {
		updateTags(tags.filter((_, i) => i !== index));
	}

	function toggleNegated(index: number) {
		tags = tags.map((t, i) => (i === index ? { ...t, negated: !t.negated } : t));
		onchange?.(tags);
	}

	// ======================================================================
	// Input handling
	// ======================================================================

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (suggestions.length > 0) {
				highlightedIndex = (highlightedIndex + 1) % suggestions.length;
				dropdownOpen = true;
			}
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (suggestions.length > 0) {
				highlightedIndex = highlightedIndex <= 0 ? suggestions.length - 1 : highlightedIndex - 1;
				dropdownOpen = true;
			}
		} else if (event.key === 'Escape') {
			dropdownOpen = false;
			highlightedIndex = -1;
		} else if (event.key === 'Enter') {
			event.preventDefault();
			handleEnter();
		} else if (event.key === 'Backspace' && inputValue === '' && tags.length > 0) {
			removeTag(tags.length - 1);
		}
	}

	function handleEnter() {
		if (phase === 'field') {
			if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
				const selected = suggestions[highlightedIndex];
				const field = fieldMap.get(selected.value);
				if (field) selectField(field);
			} else {
				// No field match — create tag with default field
				const trimmed = inputValue.trim();
				if (trimmed && defaultField) {
					addTag(defaultField.key, trimmed);
				}
			}
		} else if (phase === 'value' && activeFieldDef) {
			if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
				addTag(activeFieldDef.key, suggestions[highlightedIndex].value);
			} else if (valueInputValue.trim()) {
				addTag(activeFieldDef.key, valueInputValue);
			}
		}
	}

	function handleSuggestionClick(index: number) {
		if (phase === 'field') {
			const selected = suggestions[index];
			const field = fieldMap.get(selected.value);
			if (field) selectField(field);
		} else if (phase === 'value' && activeFieldDef) {
			addTag(activeFieldDef.key, suggestions[index].value);
		}
	}

	function handleInput() {
		dropdownOpen = true;
		highlightedIndex = -1;
	}

	function handleValueKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (suggestions.length > 0) {
				highlightedIndex = (highlightedIndex + 1) % suggestions.length;
			}
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (suggestions.length > 0) {
				highlightedIndex = highlightedIndex <= 0 ? suggestions.length - 1 : highlightedIndex - 1;
			}
		} else if (event.key === 'Escape') {
			clearActiveField();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			handleEnter();
		} else if (event.key === 'Backspace' && valueInputValue === '') {
			clearActiveField();
		}
	}

	function handleValueInput() {
		dropdownOpen = true;
		highlightedIndex = -1;
	}

	function handleFocus() {
		isFocused = true;
		dropdownOpen = true;
	}

	// Click outside to close dropdown
	function handleClickOutside(event: MouseEvent) {
		if (containerEl && !containerEl.contains(event.target as Node)) {
			dropdownOpen = false;
			isFocused = false;
			activeFieldDef = null;
			valueInputValue = '';
		}
	}

	onMount(() => {
		// Use mousedown instead of click — fires before blur, so we can check
		// containment before the dropdown re-renders
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	});
</script>

<div class="smart-filter-bar relative flex min-w-0 flex-1" bind:this={containerEl}>
	<div
		class="relative flex h-10 w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-neutral-300 bg-white px-3 transition-colors dark:border-neutral-700/60 dark:bg-neutral-800/50"
	>
		<div class="pointer-events-none flex-shrink-0">
			<Filter size={16} class="text-neutral-500 dark:text-neutral-400" />
		</div>
		{#each tags as tag, index (tag.id)}
			<FilterTagComponent
				{tag}
				fieldLabel={fieldMap.get(tag.field)?.label ?? tag.field}
				onremove={() => removeTag(index)}
				ontogglenegated={() => toggleNegated(index)}
			/>
		{/each}

		{#if activeFieldDef}
			<Label variant="info" size="md" rounded="md">{activeFieldDef.label}</Label>
			<input
				bind:this={valueInputEl}
				type="text"
				bind:value={valueInputValue}
				on:keydown={handleValueKeydown}
				on:input={handleValueInput}
				on:focus={handleFocus}
				placeholder="Type a value..."
				class="h-full min-w-[80px] flex-1 bg-transparent text-base text-neutral-900 placeholder-neutral-500 outline-none sm:text-sm dark:text-neutral-100 dark:placeholder-neutral-400"
			/>
		{:else}
			<input
				bind:this={inputEl}
				type="text"
				bind:value={inputValue}
				on:keydown={handleKeydown}
				on:input={handleInput}
				on:focus={handleFocus}
				{placeholder}
				class="h-full min-w-[120px] flex-1 bg-transparent text-base text-neutral-900 placeholder-neutral-500 outline-none sm:text-sm dark:text-neutral-100 dark:placeholder-neutral-400"
			/>
		{/if}
	</div>

	<!-- Autocomplete dropdown -->
	{#if dropdownOpen && (suggestions.length > 0 || showNumberHint)}
		<Dropdown position="left" minWidth="14rem">
			{#if phase === 'field'}
				<DropdownHeader label="Filter by" />
			{:else if showNumberHint}
				<DropdownHeader label="e.g. >1000, <500, 100-500" />
			{:else}
				<DropdownHeader label="Values" />
			{/if}
			{#each suggestions as suggestion, i}
				<DropdownItem
					label={suggestion.label}
					selected={false}
					on:click={() => handleSuggestionClick(i)}
				/>
			{/each}
		</Dropdown>
	{/if}
</div>

<style>
	.smart-filter-bar > :global(:nth-child(n + 2)) {
		border-radius: 0.75rem !important;
	}
	.smart-filter-bar > :global(:nth-child(n + 2)) :global(*) {
		border-radius: 0 !important;
	}
	.smart-filter-bar > :global(:nth-child(n + 2)) :global(:first-child) {
		border-top-left-radius: 0.75rem !important;
		border-top-right-radius: 0.75rem !important;
	}
	.smart-filter-bar > :global(:nth-child(n + 2)) :global(:last-child) {
		border-bottom-left-radius: 0.75rem !important;
		border-bottom-right-radius: 0.75rem !important;
	}
</style>
