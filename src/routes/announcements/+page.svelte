<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { Eye, EyeOff } from 'lucide-svelte';
	import { marked } from 'marked';
	import { sanitizeHtml } from '$shared/utils/sanitize.ts';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Label from '$ui/label/Label.svelte';
	import Button from '$ui/button/Button.svelte';
	import DateTime from '$ui/datetime/DateTime.svelte';
	import type { Column } from '$ui/table/types';

	function renderMarkdown(text: string): string {
		return sanitizeHtml(marked.parse(text) as string); // nosemgrep: profilarr.xss.marked-unsanitized
	}

	export let data: PageData;

	type Row = (typeof data.announcements)[number];

	const columns: Column<Row>[] = [
		{ key: 'title', header: 'Title' },
		{ key: 'severity', header: 'Severity', width: 'w-32' },
		{ key: 'publishedAt', header: 'Published', width: 'w-40' }
	];

	type SeverityVariant = 'info' | 'warning' | 'danger';
	const severityVariant: Record<Row['severity'], SeverityVariant> = {
		info: 'info',
		warning: 'warning',
		critical: 'danger'
	};

	let actionLoading: Record<string, boolean> = {};

	async function toggleRead(id: string, nextRead: boolean) {
		actionLoading = { ...actionLoading, [id]: true };
		try {
			const body = new FormData();
			body.set('id', id);
			await fetch(`?/${nextRead ? 'markRead' : 'markUnread'}`, {
				method: 'POST',
				body,
				headers: { 'x-sveltekit-action': 'true' }
			});
			await invalidateAll();
		} finally {
			actionLoading = { ...actionLoading, [id]: false };
		}
	}
</script>

<div class="p-4 md:p-8">
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-neutral-900 md:text-3xl dark:text-neutral-50">
			Announcements
		</h1>
		<p class="mt-3 text-base text-neutral-600 md:text-lg dark:text-neutral-400">
			Messages from the Profilarr team. Expand a row to read it.
		</p>
	</div>

	<ExpandableTable
		{columns}
		data={data.announcements}
		getRowId={(row) => row.id}
		emptyMessage="No announcements right now."
		responsive
		flushExpanded
		chevronPosition="right"
	>
		<svelte:fragment slot="cell" let:row let:column>
			{#if column.key === 'title'}
				<span
					class="text-sm {row.readAt
						? 'text-neutral-600 dark:text-neutral-400'
						: 'font-semibold text-neutral-900 dark:text-neutral-100'}"
				>
					{#if !row.readAt}
						<span class="mr-2 inline-block h-2 w-2 rounded-full bg-accent-500" aria-label="Unread"
						></span>
					{/if}
					{row.title}
				</span>
			{:else if column.key === 'severity'}
				<Label variant={severityVariant[row.severity]} size="md" rounded="md" mono>
					{row.severity.toUpperCase()}
				</Label>
			{:else if column.key === 'publishedAt'}
				<span class="text-xs text-neutral-500 dark:text-neutral-500">
					<DateTime value={row.publishedAt} date />
				</span>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="actions" let:row>
			{#if row.readAt}
				<Button
					icon={EyeOff}
					size="xs"
					variant="secondary"
					ariaLabel="Mark as unread"
					tooltip="Mark as unread"
					loading={actionLoading[row.id]}
					disabled={actionLoading[row.id]}
					on:click={() => toggleRead(row.id, false)}
				/>
			{:else}
				<Button
					icon={Eye}
					size="xs"
					variant="secondary"
					ariaLabel="Mark as read"
					tooltip="Mark as read"
					loading={actionLoading[row.id]}
					disabled={actionLoading[row.id]}
					on:click={() => toggleRead(row.id, true)}
				/>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="expanded" let:row>
			<div class="space-y-3 p-4">
				{#if row.body}
					<div class="prose prose-sm prose-neutral dark:prose-invert max-w-none text-sm">
						{@html renderMarkdown(row.body)}<!-- nosemgrep: profilarr.xss.at-html-usage -->
					</div>
				{:else}
					<p class="text-sm text-neutral-500 dark:text-neutral-500">
						Announcement body is not available.
					</p>
				{/if}

				{#if row.link}
					<div class="pt-1">
						<a
							href={row.link}
							target="_blank"
							rel="noopener noreferrer"
							class="text-xs text-accent-600 hover:underline dark:text-accent-400"
						>
							Read more ↗
						</a>
					</div>
				{/if}
			</div>
		</svelte:fragment>
	</ExpandableTable>
</div>
