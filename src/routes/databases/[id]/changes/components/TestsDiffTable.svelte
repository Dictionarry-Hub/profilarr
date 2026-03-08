<script lang="ts">
	import Table from '$ui/table/Table.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import { marked } from 'marked';
	import { sanitizeHtml } from '$shared/utils/sanitize.ts';
	import type { Column } from '$ui/table/types';
	import type { TestDiff, TestSnapshot } from './types';

	export let rows: TestDiff[] = [];

	const columns: Column<TestDiff>[] = [
		{ key: 'name', header: 'Name' },
		{ key: 'type', header: 'Type', width: 'w-28' },
		{ key: 'match', header: 'Match', width: 'w-40' },
		{ key: 'description', header: 'Description' }
	];

	function formatTitle(value: string): string {
		const trimmed = value.replace(/[_-]+/g, ' ').trim();
		return trimmed.replace(/\b\w/g, (char) => char.toUpperCase());
	}

	function formatTypeLabel(value: string | null | undefined): string {
		if (!value) return '—';
		const normalized = value.toLowerCase();
		if (normalized === 'movie') return 'Movie';
		if (normalized === 'series') return 'Series';
		return formatTitle(value);
	}

	function formatChange(before?: string | null, after?: string | null): string {
		if (before === undefined && after === undefined) return '—';
		if (before !== undefined && after !== undefined && before !== after) {
			return `${String(before)} -> ${String(after)}`;
		}
		return String(after ?? before);
	}

	function formatBoolean(value?: boolean): string {
		if (value === undefined) return '—';
		return value ? 'Should match' : 'Should not match';
	}

	function getField(
		row: TestDiff,
		field: keyof TestSnapshot
	): { before?: TestSnapshot[keyof TestSnapshot]; after?: TestSnapshot[keyof TestSnapshot] } {
		return {
			before: row.before?.[field],
			after: row.after?.[field]
		};
	}

	function parseMarkdown(text: string): string {
		return sanitizeHtml(marked.parse(text) as string); // nosemgrep: profilarr.xss.marked-unsanitized
	}

	function changeBadgeVariant(change: TestDiff['change']): 'success' | 'danger' | 'neutral' {
		if (change === 'added') return 'success';
		if (change === 'removed') return 'danger';
		return 'neutral';
	}
</script>

<Table {columns} data={rows} compact hoverable={false} responsive>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'name'}
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-sm text-neutral-700 dark:text-neutral-200">
					{row.name}
				</span>
				<Badge variant={changeBadgeVariant(row.change)} size="sm">
					{formatTitle(row.change)}
				</Badge>
			</div>
		{:else if column.key === 'type'}
			{@const change = getField(row, 'type')}
			{#if change.before !== undefined && change.after !== undefined && change.before !== change.after}
				<div class="flex flex-wrap items-center gap-1">
					<Badge variant="neutral" size="sm">{formatTypeLabel(change.before as string)}</Badge>
					<span class="text-neutral-400">-&gt;</span>
					<Badge variant="neutral" size="sm">{formatTypeLabel(change.after as string)}</Badge>
				</div>
			{:else}
				<Badge variant="neutral" size="sm">
					{formatTypeLabel((change.after ?? change.before) as string | null | undefined)}
				</Badge>
			{/if}
		{:else if column.key === 'match'}
			{@const change = getField(row, 'shouldMatch')}
			{#if change.before !== undefined && change.after !== undefined && change.before !== change.after}
				<div class="flex flex-wrap items-center gap-1">
					<Badge variant={(change.before as boolean) ? 'success' : 'neutral'} size="sm">
						{formatBoolean(change.before as boolean)}
					</Badge>
					<span class="text-neutral-400">-&gt;</span>
					<Badge variant={(change.after as boolean) ? 'success' : 'neutral'} size="sm">
						{formatBoolean(change.after as boolean)}
					</Badge>
				</div>
			{:else}
				<Badge variant={(change.after ?? change.before) ? 'success' : 'neutral'} size="sm">
					{formatBoolean((change.after ?? change.before) as boolean | undefined)}
				</Badge>
			{/if}
		{:else if column.key === 'description'}
			{@const change = getField(row, 'description')}
			{#if change.before !== undefined && change.after !== undefined && change.before !== change.after}
				<div class="space-y-2">
					<div>
						<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">Before</div>
						<div class="prose prose-sm prose-neutral dark:prose-invert text-sm">
							<!-- nosemgrep: profilarr.xss.at-html-usage -->
							{@html parseMarkdown(String(change.before ?? ''))}
						</div>
					</div>
					<div>
						<div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">After</div>
						<div class="prose prose-sm prose-neutral dark:prose-invert text-sm">
							<!-- nosemgrep: profilarr.xss.at-html-usage -->
							{@html parseMarkdown(String(change.after ?? ''))}
						</div>
					</div>
				</div>
			{:else if change.after !== undefined || change.before !== undefined}
				<div class="prose prose-sm prose-neutral dark:prose-invert text-sm">
					<!-- nosemgrep: profilarr.xss.at-html-usage -->
					{@html parseMarkdown(String(change.after ?? change.before ?? ''))}
				</div>
			{:else}
				<span class="text-sm text-neutral-400">—</span>
			{/if}
		{/if}
	</svelte:fragment>
</Table>
