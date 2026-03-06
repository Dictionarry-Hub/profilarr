<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { clickOutside } from '$lib/client/utils/clickOutside';
	import FormInput from '$ui/form/FormInput.svelte';
	import type { TokenCategory } from '$shared/pcd/namingTokens.ts';

	export let label: string;
	export let name: string;
	export let value: string;
	export let placeholder: string = '';
	export let categories: TokenCategory[];
	export let inputElement: HTMLInputElement | HTMLTextAreaElement | null = null;

	const dispatch = createEventDispatcher<{ input: string }>();

	interface FlatToken {
		token: string;
		description: string;
		example: string;
		category: string;
	}

	let open = false;
	let highlightedIndex = -1;
	let triggerPos = -1;
	let listboxElement: HTMLDivElement | null = null;

	$: flatTokens = categories.flatMap((cat) =>
		cat.tokens.map((t) => ({ ...t, category: cat.name }))
	) as FlatToken[];

	$: query = '';
	$: filteredTokens = open
		? flatTokens.filter((t) => t.token.toLowerCase().includes(query.toLowerCase()))
		: [];

	function findTrigger(): { found: boolean; query: string; pos: number } {
		if (!inputElement) return { found: false, query: '', pos: -1 };
		const cursor = inputElement.selectionStart ?? inputElement.value.length;
		const text = inputElement.value.slice(0, cursor);

		// Scan backward for an unmatched {
		for (let i = text.length - 1; i >= 0; i--) {
			if (text[i] === '}') return { found: false, query: '', pos: -1 };
			if (text[i] === '{') {
				return {
					found: true,
					query: text.slice(i + 1),
					pos: i
				};
			}
		}
		return { found: false, query: '', pos: -1 };
	}

	function handleInput(e: CustomEvent<string>) {
		value = e.detail;
		dispatch('input', value);

		const result = findTrigger();
		if (result.found) {
			query = result.query;
			triggerPos = result.pos;
			open = true;
			highlightedIndex = 0;
		} else {
			close();
		}
	}

	function handleFocus() {
		open = true;
		highlightedIndex = 0;

		const result = findTrigger();
		if (result.found) {
			query = result.query;
			triggerPos = result.pos;
		} else {
			query = '';
			triggerPos = -1;
		}
	}

	function moveHighlight(direction: 1 | -1) {
		if (filteredTokens.length === 0) {
			highlightedIndex = -1;
			return;
		}
		if (highlightedIndex < 0 || highlightedIndex >= filteredTokens.length) {
			highlightedIndex = direction === 1 ? 0 : filteredTokens.length - 1;
		} else {
			highlightedIndex =
				(highlightedIndex + direction + filteredTokens.length) % filteredTokens.length;
		}

		// Scroll highlighted item into view
		if (listboxElement) {
			const item = listboxElement.children[highlightedIndex] as HTMLElement;
			item?.scrollIntoView({ block: 'nearest' });
		}
	}

	function selectToken(token: FlatToken) {
		if (!inputElement) return;

		const cursor = inputElement.selectionStart ?? inputElement.value.length;
		const insertPos = triggerPos >= 0 ? triggerPos : cursor;
		const before = inputElement.value.slice(0, insertPos);
		const after = inputElement.value.slice(cursor);
		const newValue = before + token.token + after;

		value = newValue;
		inputElement.value = newValue;

		const newCursor = insertPos + token.token.length;
		inputElement.selectionStart = newCursor;
		inputElement.selectionEnd = newCursor;
		inputElement.focus();

		dispatch('input', newValue);
		close();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!open) return;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				moveHighlight(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				moveHighlight(-1);
				break;
			case 'Enter':
				if (filteredTokens.length > 0) {
					event.preventDefault();
					const index =
						highlightedIndex >= 0 && highlightedIndex < filteredTokens.length
							? highlightedIndex
							: 0;
					selectToken(filteredTokens[index]);
				}
				break;
			case 'Escape':
				event.preventDefault();
				close();
				break;
		}
	}

	function close() {
		open = false;
		highlightedIndex = -1;
		triggerPos = -1;
		query = '';
	}
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="relative" use:clickOutside={close} on:keydown={handleKeyDown}>
	<FormInput
		{label}
		{name}
		{value}
		{placeholder}
		mono
		wrap
		bind:inputElement
		on:input={handleInput}
		on:focus={handleFocus}
	/>

	{#if open && filteredTokens.length > 0}
		<div
			bind:this={listboxElement}
			role="listbox"
			class="absolute top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-neutral-300 bg-white p-1 shadow-sm dark:border-neutral-700/60 dark:bg-neutral-800"
		>
			{#each filteredTokens as token, index}
				<button
					type="button"
					role="option"
					aria-selected={highlightedIndex === index}
					on:mouseenter={() => (highlightedIndex = index)}
					on:mousedown|preventDefault={() => selectToken(token)}
					class="w-full rounded-lg px-3 py-2 text-left transition-colors {highlightedIndex === index
						? 'bg-neutral-100 dark:bg-neutral-700/60'
						: 'hover:bg-neutral-50 dark:hover:bg-neutral-700/30'}"
				>
					<div class="flex items-center justify-between">
						<span
							class="font-mono text-sm {highlightedIndex === index
								? 'text-neutral-900 dark:text-neutral-50'
								: 'text-neutral-700 dark:text-neutral-200'}">{token.token}</span
						>
						<span class="text-xs text-neutral-400 dark:text-neutral-500">{token.category}</span>
					</div>
					<p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{token.description}</p>
				</button>
			{/each}
		</div>
	{/if}
</div>
