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
		class="markdown text-xs text-text-soft"
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
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		box-shadow: var(--shadow-control);
		color: var(--color-text-soft);
		padding: 0.125rem 0.25rem;
		border-radius: var(--radius-control-sm);
		font-size: 0.75rem;
		font-family: var(--font-mono);
	}

	.markdown :global(strong) {
		font-weight: 600;
	}

	.markdown :global(a) {
		color: var(--theme-link-text);
		text-decoration: underline;
	}
</style>
