<script lang="ts">
	import hljs from 'highlight.js/lib/core';
	import json from 'highlight.js/lib/languages/json';
	import sql from 'highlight.js/lib/languages/sql';

	hljs.registerLanguage('json', json);
	hljs.registerLanguage('sql', sql);

	export let data: unknown;

	// Check if data has a queries array with SQL strings
	$: hasQueries =
		data &&
		typeof data === 'object' &&
		'queries' in data &&
		Array.isArray((data as Record<string, unknown>).queries);

	// Extract queries separately for SQL highlighting
	$: queries = hasQueries ? ((data as Record<string, unknown>).queries as string[]) : [];

	// Create data without queries for JSON display
	$: dataWithoutQueries = hasQueries
		? Object.fromEntries(
				Object.entries(data as Record<string, unknown>).filter(([k]) => k !== 'queries')
			)
		: data;

	$: jsonString = JSON.stringify(dataWithoutQueries, null, 2);
	$: highlightedJson = hljs.highlight(jsonString, { language: 'json' }).value;

	function highlightSql(query: string): string {
		return hljs.highlight(query, { language: 'sql' }).value;
	}
</script>

<div class="json-view space-y-4">
	<!-- JSON metadata -->
	<pre class="!m-0 !bg-transparent !p-0 font-mono whitespace-pre-wrap"><code class="hljs font-mono"
			><!-- nosemgrep: profilarr.xss.at-html-usage, profilarr.xss.raw-variable-in-html -->
		{@html highlightedJson}</code
		></pre>

	<!-- SQL Queries -->
	{#if queries.length > 0}
		<div class="border-t border-neutral-200 pt-4 dark:border-neutral-700">
			<div
				class="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
			>
				Queries ({queries.length})
			</div>
			<div class="space-y-2">
				{#each queries as query, i}
					<div
						class="rounded border border-neutral-200 bg-neutral-100 p-3 dark:border-neutral-600 dark:bg-neutral-900"
					>
						<pre class="!m-0 !bg-transparent !p-0 font-mono text-xs whitespace-pre-wrap"><code
								class="hljs font-mono"
								><!-- nosemgrep: profilarr.xss.at-html-usage -->{@html highlightSql(query)}</code
							></pre>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.json-view :global(.hljs),
	.json-view :global(.hljs *) {
		background: transparent !important;
		font-family: var(--font-mono) !important;
	}
</style>
