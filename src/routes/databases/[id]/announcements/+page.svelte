<script lang="ts">
	import type { PageData } from './$types';
	import { Plus, AlertTriangle, ExternalLink, Edit3, Trash2 } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { marked } from 'marked';
	import { sanitizeHtml } from '$shared/utils/sanitize.ts';
	import Button from '$ui/button/Button.svelte';
	import Card from '$ui/card/Card.svelte';
	import Label from '$ui/label/Label.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import EmptyState from '$ui/state/EmptyState.svelte';
	import DateTime from '$ui/datetime/DateTime.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import WithdrawAnnouncementModal from './components/WithdrawAnnouncementModal.svelte';
	import type { Column } from '$ui/table/types';

	function renderMarkdown(text: string): string {
		return sanitizeHtml(marked.parse(text) as string); // nosemgrep: profilarr.xss.marked-unsanitized
	}

	export let data: PageData;

	$: databaseId = data.databaseId;

	type Row = (typeof data.announcements)[number];

	const columns: Column<Row>[] = [
		{ key: 'title', header: 'Title' },
		{ key: 'severity', header: 'Severity', width: 'w-32' },
		{ key: 'publishedAt', header: 'Published', width: 'w-40' },
		{ key: 'expiresAt', header: 'Expires', width: 'w-40' }
	];

	type SeverityVariant = 'info' | 'warning' | 'danger';
	const severityVariant: Record<Row['severity'], SeverityVariant> = {
		info: 'info',
		warning: 'warning',
		critical: 'danger'
	};

	let withdrawTarget: Row | null = null;
</script>

<div class="space-y-5">
	{#if data.announcements.length > 0}
		<StickyCard position="top">
			<svelte:fragment slot="left">
				<h1 class="text-text">Announcements</h1>
				<p class="text-text-soft">
					Author messages that linked instances of this database will see in their inbox.
				</p>
			</svelte:fragment>
			<svelte:fragment slot="right">
				<Button
					text="New announcement"
					icon={Plus}
					variant="secondary"
					iconColor="text-info-icon "
					on:click={() => goto(`/databases/${databaseId}/announcements/new`)}
				/>
			</svelte:fragment>
		</StickyCard>
	{/if}

	{#if data.parseErrors.length > 0}
		<Card padding="md">
			<div class="flex items-start gap-3">
				<AlertTriangle class="h-5 w-5 flex-shrink-0 text-warning-icon " />
				<div class="space-y-2 text-sm">
					<div class="font-medium text-text">
						{data.parseErrors.length} file(s) could not be parsed
					</div>
					<ul class="space-y-1 text-xs text-text-soft">
						{#each data.parseErrors as err}
							<li>
								<code class="font-mono">{err.filename}</code>
								<span class="ml-2">{err.reason}</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</Card>
	{/if}

	{#if data.announcements.length === 0}
		<EmptyState
			icon={Edit3}
			title="No announcements yet"
			description="When you publish an announcement here, it ships with the next push of this database."
			buttonText="New announcement"
			buttonHref={`/databases/${databaseId}/announcements/new`}
			buttonIcon={Plus}
		/>
	{:else}
		<ExpandableTable
			data={data.announcements}
			{columns}
			getRowId={(row) => row.id}
			emptyMessage="No announcements"
			responsive
			flushExpanded
			chevronPosition="right"
		>
			<svelte:fragment slot="actions" let:row>
				<div class="flex items-center justify-end gap-2">
					<Button
						icon={Edit3}
						size="xs"
						variant="secondary"
						iconColor="text-info-icon "
						ariaLabel="Edit"
						tooltip="Edit"
						on:click={() => goto(`/databases/${databaseId}/announcements/${row.id}`)}
					/>
					<Button
						icon={Trash2}
						size="xs"
						variant="secondary"
						iconColor="text-danger-icon "
						ariaLabel="Withdraw"
						tooltip="Withdraw"
						on:click={() => (withdrawTarget = row)}
					/>
				</div>
			</svelte:fragment>

			<svelte:fragment slot="cell" let:row let:column>
				{#if column.key === 'title'}
					<span class="text-sm font-medium text-text">{row.title}</span>
					{#if row.link}
						<a
							href={row.link}
							target="_blank"
							rel="noopener noreferrer"
							class="ml-2 inline-flex items-center text-link-text hover:underline"
							on:click|stopPropagation
							aria-label="External link"
						>
							<ExternalLink class="h-3 w-3" />
						</a>
					{/if}
				{:else if column.key === 'severity'}
					<Label variant={severityVariant[row.severity]} size="md" radius="md" mono>
						{row.severity.toUpperCase()}
					</Label>
				{:else if column.key === 'publishedAt'}
					<span class="text-xs text-text-muted">
						<DateTime value={row.publishedAt} date />
					</span>
				{:else if column.key === 'expiresAt'}
					{#if row.expiresAt}
						<span class="text-xs text-text-muted">
							<DateTime value={row.expiresAt} date />
						</span>
					{:else}
						<span class="text-xs text-text-subtle">never</span>
					{/if}
				{/if}
			</svelte:fragment>

			<svelte:fragment slot="expanded" let:row>
				<div class="space-y-3 p-4">
					{#if row.body}
						<div class="prose prose-sm prose-neutral dark:prose-invert max-w-none text-sm">
							{@html renderMarkdown(row.body)}<!-- nosemgrep: profilarr.xss.at-html-usage -->
						</div>
					{:else}
						<p class="text-sm text-text-muted">This announcement has no body.</p>
					{/if}
				</div>
			</svelte:fragment>
		</ExpandableTable>
	{/if}
</div>

<WithdrawAnnouncementModal
	open={withdrawTarget !== null}
	{databaseId}
	announcementId={withdrawTarget?.id ?? null}
	on:cancel={() => (withdrawTarget = null)}
	on:withdrawn={() => (withdrawTarget = null)}
/>
