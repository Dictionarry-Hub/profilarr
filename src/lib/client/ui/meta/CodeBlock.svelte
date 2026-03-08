<script lang="ts">
	import hljs from 'highlight.js/lib/core';
	import json from 'highlight.js/lib/languages/json';
	import sql from 'highlight.js/lib/languages/sql';

	hljs.registerLanguage('json', json);
	hljs.registerLanguage('sql', sql);

	export let code: string = '';
	export let language: string = 'sql';
	export let label: string | null = null;

	$: resolvedLanguage = hljs.getLanguage(language) ? language : 'plaintext';
	$: highlighted =
		code.length === 0
			? ''
			: resolvedLanguage === 'plaintext'
				? hljs.highlightAuto(code).value
				: hljs.highlight(code, { language: resolvedLanguage }).value;
</script>

<div class="code-block space-y-2">
	{#if label}
		<div
			class="flex items-center gap-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
		>
			<slot name="icon" />
			{label}
		</div>
	{/if}
	<pre
		class="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs break-words whitespace-pre-wrap text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
<!-- nosemgrep: profilarr.xss.at-html-usage, profilarr.xss.raw-variable-in-html -->
<code class="hljs font-mono">{@html highlighted}</code></pre>
</div>

<style>
	.code-block :global(.hljs),
	.code-block :global(.hljs *) {
		background: transparent !important;
		font-family: var(--font-mono) !important;
	}
</style>
