<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Table from '$ui/table/Table.svelte';
	import Button from '$ui/button/Button.svelte';
	import type { Column } from '$ui/table/types';
	import type { CustomFormatTableRow } from '$shared/pcd/display.ts';
	import { Tag, FileText, Layers, FlaskConical, Copy, Download } from 'lucide-svelte';
	import { marked } from 'marked';
	import { sanitizeHtml } from '$shared/utils/sanitize';
	import { page } from '$app/stores';
	import { sortConditions } from '$shared/pcd/conditions';
	import { FEATURES } from '$shared/features.ts';

	export let formats: CustomFormatTableRow[];

	const dispatch = createEventDispatcher<{ clone: { name: string }; export: { name: string } }>();

	$: databaseId = $page.params.databaseId;

	function getRowHref(row: CustomFormatTableRow): string {
		return `/custom-formats/${databaseId}/${row.id}`;
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

	const columns: Column<CustomFormatTableRow>[] = [
		{
			key: 'name',
			header: 'Name',
			headerIcon: Tag,
			align: 'left',
			sortable: true,
			width: 'w-48',
			cell: (row: CustomFormatTableRow) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — all interpolations use escapeHtml()
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
									<span class="inline-flex items-center px-2 py-0.5 rounded-control-sm text-[10px] font-medium bg-accent-solid text-on-accent">
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
			key: 'description',
			header: 'Description',
			headerIcon: FileText,
			align: 'left',
			cell: (row: CustomFormatTableRow) => ({
				html: row.description
					? `<span class="text-sm text-text-soft prose-inline">${parseMarkdown(row.description)}</span>`
					: `<span class="text-text-muted">-</span>`
			})
		},
		{
			key: 'conditions',
			header: 'Conditions',
			headerIcon: Layers,
			align: 'left',
			cell: (row: CustomFormatTableRow) => ({
				html:
					row.conditions.length > 0
						? `<div class="flex flex-wrap gap-1">${sortConditions(row.conditions)
								.map((c) => {
									// Color based on required/negate:
									// required + negate = red (must NOT match)
									// required + !negate = green (must match)
									// !required + negate = amber (optional negative)
									// !required + !negate = neutral (optional)
									let colorClass: string;
									if (c.required && c.negate) {
										colorClass = 'bg-danger-solid text-on-danger';
									} else if (c.required) {
										colorClass = 'bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]';
									} else if (c.negate) {
										colorClass = 'bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]';
									} else {
										colorClass = 'border border-border bg-surface text-text-soft shadow-control';
									}
									return `<span class="inline-flex items-center px-1.5 py-0.5 rounded-control-sm font-mono text-[10px] font-medium ${colorClass}">${escapeHtml(c.name)}</span>`;
								})
								.join('')}</div>`
						: `<span class="text-text-muted text-xs">None</span>`
			})
		},
		{
			key: 'testCount',
			header: 'Tests',
			headerIcon: FlaskConical,
			align: 'center',
			width: 'w-20',
			sortable: true,
			cell: (row: CustomFormatTableRow) => ({
				html:
					row.testCount > 0
						? `<span class="inline-flex items-center px-2 py-0.5 rounded-control-sm text-xs font-medium border border-border bg-surface text-text-soft shadow-control">${row.testCount}</span>`
						: `<span class="text-text-muted text-xs">-</span>`
			})
		}
	];
</script>

<Table
	data={formats}
	{columns}
	emptyMessage="No custom formats found"
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
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		box-shadow: var(--shadow-control);
		color: var(--color-text-soft);
		padding: 0.125rem 0.25rem;
		border-radius: var(--radius-control-sm);
		font-size: 0.75rem;
		font-family: var(--font-mono);
	}

	:global(.prose-inline strong) {
		font-weight: 600;
	}

	:global(.prose-inline a) {
		color: var(--theme-link-text);
		text-decoration: underline;
	}
</style>
