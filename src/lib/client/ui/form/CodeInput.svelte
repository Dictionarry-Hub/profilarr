<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import { tokenize } from '$lib/client/utils/tokenize';
	import { themeStore } from '$lib/client/stores/theme';
	import { getTheme, type ThemeVariant } from '$ui/code/themes';

	export let label: string;
	export let description = '';
	export let placeholder = '';
	export let value = '';
	export let name = '';
	export let rows = 10;
	export let language = 'json';
	export let required = false;
	export let disabled = false;
	export let readonly = false;
	export let inputElement: HTMLTextAreaElement | null = null;

	const dispatch = createEventDispatcher<{ input: string; focus: void; blur: void }>();

	let highlightElement: HTMLPreElement | null = null;
	let themeName = browser ? localStorage.getItem('code-theme') || 'Default' : 'Default';

	$: theme = getTheme(themeName);
	$: variant = $themeStore === 'dark' ? theme.dark : theme.light;
	$: tokens = tokenize(value, language);
	$: displayTokens = tokens.length > 0 ? tokens : [{ type: 'text', text: placeholder }];
	$: placeholderClass = value ? '' : 'opacity-45';
	$: stateClass =
		readonly || disabled
			? 'cursor-not-allowed opacity-70'
			: 'focus:border-neutral-300 dark:focus:border-neutral-600';

	function tokenColor(type: string, v: ThemeVariant): string | undefined {
		return (v as unknown as Record<string, string>)[type] ?? undefined;
	}

	function handleInput(e: Event) {
		value = (e.target as HTMLTextAreaElement).value;
		dispatch('input', value);
	}

	function handleScroll(e: Event) {
		if (!highlightElement) return;
		const target = e.target as HTMLTextAreaElement;
		highlightElement.scrollTop = target.scrollTop;
		highlightElement.scrollLeft = target.scrollLeft;
	}
</script>

<div class="space-y-2">
	<label for={name} class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
		{label}{#if required}<span class="text-red-500">*</span>{/if}
	</label>

	{#if description}
		<p class="text-xs text-neutral-600 dark:text-neutral-400">
			{description}
		</p>
	{/if}

	<div
		class="relative overflow-hidden rounded-xl border border-neutral-300 dark:border-neutral-700/60"
	>
		<pre
			bind:this={highlightElement}
			aria-hidden="true"
			class="pointer-events-none absolute inset-0 overflow-auto p-3 text-sm leading-5 whitespace-pre-wrap"
			style="background-color: {variant.bg}; color: {variant.text}; min-height: {rows * 1.25 +
				1.5}rem;"><code class={placeholderClass}
				>{#each displayTokens as t}<span
						style={tokenColor(t.type, variant) ? `color: ${tokenColor(t.type, variant)}` : ''}
						>{t.text}</span
					>{/each}{value.endsWith('\n') ? ' ' : ''}</code
			></pre>
		<textarea
			id={name}
			{name}
			{value}
			{required}
			{disabled}
			{readonly}
			{rows}
			spellcheck="false"
			autocomplete="off"
			autocapitalize="off"
			bind:this={inputElement}
			class="relative block w-full resize-y overflow-auto border-0 bg-transparent p-3 text-sm leading-5 whitespace-pre-wrap text-transparent caret-neutral-900 outline-none selection:bg-accent-500/30 dark:caret-neutral-50 {stateClass}"
			style="min-height: {rows * 1.25 + 1.5}rem;"
			oninput={handleInput}
			onscroll={handleScroll}
			onfocus={() => dispatch('focus')}
			onblur={() => dispatch('blur')}
		></textarea>
	</div>
</div>

<style>
	pre,
	pre *,
	textarea {
		font-family: var(--font-code);
		tab-size: 2;
	}
</style>
