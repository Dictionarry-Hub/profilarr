<script lang="ts">
	import { tokenize } from '$lib/client/utils/tokenize';
	import { themes, getTheme, type ThemeVariant } from './themes';
	import { themeStore } from '$lib/client/stores/theme';
	import { browser } from '$app/environment';
	import { Copy, Check, ChevronDown } from 'lucide-svelte';
	import Label from '$ui/label/Label.svelte';
	import Button from '$ui/button/Button.svelte';
	import { copyToClipboard } from '$lib/client/utils/clipboard';

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
	$: langCustomVariant = language === 'json' ? 'bg-warning-bg text-warning-text ' : '';

	function tokenColor(type: string, v: ThemeVariant): string | undefined {
		return (v as unknown as Record<string, string>)[type] ?? undefined;
	}

	function selectTheme(name: string) {
		themeName = name;
		if (browser) localStorage.setItem('code-theme', name);
	}

	async function handleCopy() {
		const copiedOk = await copyToClipboard(code);
		if (copiedOk) {
			copied = true;
			if (copyTimeout) clearTimeout(copyTimeout);
			copyTimeout = setTimeout(() => {
				copied = false;
			}, 2000);
		}
	}
</script>

<div class="code-block overflow-hidden rounded-card border border-border">
	<div class="flex flex-wrap items-center gap-2 border-b border-border bg-surface-muted px-3 py-2">
		<Label variant={langVariant} customVariant={langCustomVariant} size="sm" radius="md" mono
			>{langLabel}</Label
		>
		<slot name="header" />
		<div class="ml-auto flex items-center gap-2">
			{#if themes.length > 1}
				<div class="relative">
					<select
						value={themeName}
						onchange={(e) => selectTheme(e.currentTarget.value)}
						class="appearance-none rounded-control-sm bg-surface-hover py-0.5 pr-5 pl-1.5 font-mono text-[10px] font-medium text-text-subtle"
					>
						{#each themes as t}
							<option value={t.name}>{t.name}</option>
						{/each}
					</select>
					<ChevronDown
						size={10}
						class="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 text-text-subtle"
					/>
				</div>
			{/if}
			{#if copyable}
				<Button
					icon={copied ? Check : Copy}
					iconColor={copied ? 'text-success-icon' : ''}
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
