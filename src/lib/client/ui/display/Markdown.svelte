<script lang="ts">
	import { marked } from 'marked';
	import { sanitizeHtml } from '$shared/utils/sanitize';

	export let content: string | null = null;
	export let inline: boolean = true;
	export let maxLines: number | undefined = undefined;

	$: html = content
		? sanitizeHtml(
				inline
					? (marked.parseInline(content) as string) // nosemgrep: profilarr.xss.marked-unsanitized
					: (marked.parse(content) as string) // nosemgrep: profilarr.xss.marked-unsanitized
			)
		: '';
</script>

{#if html}
	<span
		class="markdown text-xs text-neutral-600 dark:text-neutral-400"
		style={maxLines
			? `display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: ${maxLines}; overflow: hidden;`
			: ''}
	>
		<!-- nosemgrep: profilarr.xss.at-html-usage, profilarr.xss.raw-variable-in-html -->
		{@html html}
	</span>
{/if}

<style>
	.markdown :global(code) {
		background-color: rgb(229 231 235);
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		font-family: ui-monospace, monospace;
	}

	:global(.dark) .markdown :global(code) {
		background-color: rgb(38 38 38);
	}

	.markdown :global(strong) {
		font-weight: 600;
	}

	.markdown :global(a) {
		color: rgb(var(--color-accent-600));
		text-decoration: underline;
	}

	:global(.dark) .markdown :global(a) {
		color: rgb(var(--color-accent-400));
	}
</style>
