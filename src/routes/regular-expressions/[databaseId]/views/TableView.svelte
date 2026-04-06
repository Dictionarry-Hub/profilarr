<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Table from '$ui/table/Table.svelte';
	import Button from '$ui/button/Button.svelte';
	import type { Column } from '$ui/table/types';
	import type { RegularExpressionWithTags } from '$shared/pcd/display';
	import { Tag, Code, FileText, Link, Copy, Download } from 'lucide-svelte';
	import { marked } from 'marked';
	import { sanitizeHtml } from '$shared/utils/sanitize';
	import { page } from '$app/stores';
	import { FEATURES } from '$shared/features.ts';

	export let expressions: RegularExpressionWithTags[];

	const dispatch = createEventDispatcher<{ clone: { name: string }; export: { name: string } }>();

	$: databaseId = $page.params.databaseId;

	function getRowHref(row: RegularExpressionWithTags): string {
		return `/regular-expressions/${databaseId}/${row.id}`;
	}

	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	function parseMarkdown(text: string | null): string {
		if (!text) return '';
		return sanitizeHtml(marked.parseInline(text) as string); // nosemgrep: profilarr.xss.marked-unsanitized
	}

	const columns: Column<RegularExpressionWithTags>[] = [
		{
			key: 'name',
			header: 'Name',
			headerIcon: Tag,
			align: 'left',
			sortable: true,
			width: 'w-48',
			cell: (row: RegularExpressionWithTags) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — all values use escapeHtml()
				html: `
					<div>
						<div class="font-medium">${escapeHtml(row.name)}</div>
						${
							row.tags.length > 0
								? `
							<div class="mt-1 flex flex-wrap gap-1">
								${row.tags
									.map(
										(tag) => `
									<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200">
										${escapeHtml(tag.name)}
									</span>
								`
									)
									.join('')}
							</div>
						`
								: ''
						}
					</div>
				`
			})
		},
		{
			key: 'pattern',
			header: 'Pattern',
			headerIcon: Code,
			align: 'left',
			width: 'w-[40%]',
			cell: (row: RegularExpressionWithTags) => ({
				html: `<code class="font-mono text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded break-all">${escapeHtml(row.pattern)}</code>`
			})
		},
		{
			key: 'description',
			header: 'Description',
			headerIcon: FileText,
			align: 'left',
			width: 'w-[30%]',
			cell: (row: RegularExpressionWithTags) => ({
				html: row.description
					? `<span class="text-sm text-neutral-600 dark:text-neutral-400 prose-inline">${parseMarkdown(row.description)}</span>`
					: `<span class="text-neutral-400">-</span>`
			})
		},
		{
			key: 'regex101_id',
			header: 'Regex101',
			headerIcon: Link,
			align: 'left',
			width: 'w-24',
			cell: (row: RegularExpressionWithTags) => ({
				html: row.regex101_id
					? `<a href="https://regex101.com/r/${escapeHtml(row.regex101_id)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-mono text-xs text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300 hover:underline">${escapeHtml(row.regex101_id)}<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>`
					: `<span class="text-neutral-400">-</span>`
			})
		}
	];
</script>

<Table
	data={expressions}
	{columns}
	emptyMessage="No regular expressions found"
	hoverable={true}
	compact={false}
	rowHref={getRowHref}
	pageSize={50}
>
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<svelte:fragment slot="actions" let:row>
		<div class="flex items-center justify-end gap-0.5" on:click|stopPropagation>
			{#if FEATURES.importExport}
				<Button
					icon={Download}
					size="xs"
					variant="ghost"
					tooltip="Export"
					on:click={() => dispatch('export', { name: row.name })}
				/>
			{/if}
			<Button
				icon={Copy}
				size="xs"
				variant="secondary"
				tooltip="Clone"
				on:click={() => dispatch('clone', { name: row.name })}
			/>
		</div>
	</svelte:fragment>
</Table>

<style>
	/* Inline prose styles for markdown content */
	:global(.prose-inline code) {
		background-color: rgb(229 231 235);
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		font-family: var(--font-mono);
	}

	:global(.dark .prose-inline code) {
		background-color: rgb(38 38 38);
	}

	:global(.prose-inline strong) {
		font-weight: 600;
	}

	:global(.prose-inline a) {
		color: rgb(var(--color-accent-600));
		text-decoration: underline;
	}

	:global(.dark .prose-inline a) {
		color: rgb(var(--color-accent-400));
	}
</style>
