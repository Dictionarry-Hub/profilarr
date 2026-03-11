<script lang="ts">
	import { tokenize } from '$lib/client/utils/tokenize';
	import { themes, getTheme, type ThemeVariant } from './themes';
	import { themeStore } from '$lib/client/stores/theme';
	import { browser } from '$app/environment';
	import { Copy, Check, ChevronDown } from 'lucide-svelte';
	import Label from '$ui/label/Label.svelte';
	import Button from '$ui/button/Button.svelte';

	export let code: string = '';
	export let language: string = 'sql';
	export let copyable: boolean = true;

	let copied = false;
	let copyTimeout: ReturnType<typeof setTimeout> | null = null;
	let themeName = browser ? localStorage.getItem('code-theme') || 'Default' : 'Default';

	$: theme = getTheme(themeName);
	$: variant = $themeStore === 'dark' ? theme.dark : theme.light;
	$: tokens = tokenize(code, language);
	$: langLabel = language === 'sql' ? 'SQL' : language === 'json' ? 'JSON' : language;
	$: langVariant = language === 'sql' ? ('info' as const) : ('secondary' as const);
	$: langCustomVariant =
		language === 'json'
			? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
			: '';

	function tokenColor(type: string, v: ThemeVariant): string | undefined {
		return (v as unknown as Record<string, string>)[type] ?? undefined;
	}

	function selectTheme(name: string) {
		themeName = name;
		if (browser) localStorage.setItem('code-theme', name);
	}

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(code);
			copied = true;
			if (copyTimeout) clearTimeout(copyTimeout);
			copyTimeout = setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			// clipboard not available
		}
	}
</script>

<div
	class="code-block overflow-hidden rounded-xl border border-neutral-300 dark:border-neutral-700/60"
>
	<div
		class="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700/60 dark:bg-neutral-900"
	>
		<Label variant={langVariant} customVariant={langCustomVariant} size="sm" rounded="md" mono
			>{langLabel}</Label
		>
		<slot name="header" />
		<div class="ml-auto flex items-center gap-2">
			{#if themes.length > 1}
				<div class="relative">
					<select
						value={themeName}
						onchange={(e) => selectTheme(e.currentTarget.value)}
						class="appearance-none rounded bg-neutral-100 py-0.5 pr-5 pl-1.5 font-mono text-[10px] font-medium text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
					>
						{#each themes as t}
							<option value={t.name}>{t.name}</option>
						{/each}
					</select>
					<ChevronDown
						size={10}
						class="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
					/>
				</div>
			{/if}
			{#if copyable}
				<Button
					icon={copied ? Check : Copy}
					iconColor={copied ? 'text-green-500' : ''}
					size="xs"
					variant="secondary"
					title="Copy to clipboard"
					on:click={handleCopy}
				/>
			{/if}
		</div>
	</div>

	<div style="background-color: {variant.bg}">
		<pre
			class="overflow-x-auto p-3 text-xs leading-5 whitespace-pre"
			style="color: {variant.text}"><code
				>{#each tokens as t}<span
						style={tokenColor(t.type, variant) ? `color: ${tokenColor(t.type, variant)}` : ''}
						>{t.text}</span
					>{/each}</code
			></pre>
	</div>
</div>

<style>
	.code-block :global(pre),
	.code-block :global(pre *) {
		font-family: var(--font-code);
	}
</style>
