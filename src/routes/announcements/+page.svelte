<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { Database, Eye, EyeOff, Info, ArrowDownUp, Filter, MailCheck } from 'lucide-svelte';
	import { marked } from 'marked';
	import { sanitizeHtml } from '$shared/utils/sanitize.ts';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Label from '$ui/label/Label.svelte';
	import Button from '$ui/button/Button.svelte';
	import DateTime from '$ui/datetime/DateTime.svelte';
	import type { Column } from '$ui/table/types';
	import DatabaseAvatar from '../databases/components/DatabaseAvatar.svelte';
	import logo from '$assets/logo-512.png';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import { getPersistentSearchStore } from '$stores/search';
	import { alertStore } from '$alerts/store';

	function renderMarkdown(text: string): string {
		return sanitizeHtml(marked.parse(text) as string); // nosemgrep: profilarr.xss.marked-unsanitized
	}

	export let data: PageData;

	type Row = (typeof data.announcements)[number];

	type SortKey = 'newest' | 'oldest' | 'title' | 'severity' | 'unread';

	const sortOptions: { key: SortKey; label: string }[] = [
		{ key: 'newest', label: 'Newest first' },
		{ key: 'oldest', label: 'Oldest first' },
		{ key: 'title', label: 'Title (A→Z)' },
		{ key: 'severity', label: 'Severity (critical first)' },
		{ key: 'unread', label: 'Unread first' }
	];

	const severityRank: Record<Row['severity'], number> = {
		critical: 0,
		warning: 1,
		info: 2
	};

	let sortKey: SortKey = 'newest';

	const searchStore = getPersistentSearchStore('announcementsSearch', { debounceMs: 150 });
	$: searchQuery = $searchStore.query;

	type SourceFilterKey = 'profilarr' | `pcd:${number}`;

	$: pcdSources = Array.from(
		new Map(
			data.announcements
				.filter(
					(r): r is Row & { databaseId: number } => r.source === 'pcd' && r.databaseId !== null
				)
				.map((r) => [r.databaseId, r.databaseName ?? '(unknown)'])
		).entries()
	);

	$: availableSourceKeys = [
		'profilarr' as SourceFilterKey,
		...pcdSources.map(([id]) => `pcd:${id}` as SourceFilterKey)
	];

	let enabledSources: Set<SourceFilterKey> = new Set();
	let initializedSources = false;

	$: if (!initializedSources && availableSourceKeys.length > 0) {
		enabledSources = new Set(availableSourceKeys);
		initializedSources = true;
	}

	$: if (initializedSources) {
		const next = new Set<SourceFilterKey>();
		for (const key of availableSourceKeys) {
			if (enabledSources.has(key)) next.add(key);
		}
		if (next.size !== enabledSources.size) {
			enabledSources = next;
		}
	}

	function rowSourceKey(row: Row): SourceFilterKey {
		return row.source === 'profilarr' ? 'profilarr' : (`pcd:${row.databaseId}` as SourceFilterKey);
	}

	function toggleSource(key: SourceFilterKey) {
		const next = new Set(enabledSources);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		enabledSources = next;
	}

	function compareRows(a: Row, b: Row, key: SortKey): number {
		switch (key) {
			case 'newest':
				return a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0;
			case 'oldest':
				return a.publishedAt < b.publishedAt ? -1 : a.publishedAt > b.publishedAt ? 1 : 0;
			case 'title':
				return a.title.localeCompare(b.title);
			case 'severity': {
				const diff = severityRank[a.severity] - severityRank[b.severity];
				if (diff !== 0) return diff;
				return a.publishedAt < b.publishedAt ? 1 : -1;
			}
			case 'unread': {
				const aUnread = a.readAt === null ? 0 : 1;
				const bUnread = b.readAt === null ? 0 : 1;
				if (aUnread !== bUnread) return aUnread - bUnread;
				return a.publishedAt < b.publishedAt ? 1 : -1;
			}
		}
	}

	$: visibleRows = (() => {
		const q = searchQuery.trim().toLowerCase();
		const filtered = data.announcements.filter((row) => {
			if (!enabledSources.has(rowSourceKey(row))) return false;
			if (q && !row.title.toLowerCase().includes(q)) return false;
			return true;
		});
		return [...filtered].sort((a, b) => compareRows(a, b, sortKey));
	})();

	const columns: Column<Row>[] = [
		{ key: 'severity', header: 'Severity', width: 'w-32' },
		{ key: 'title', header: 'Title' },
		{ key: 'publishedAt', header: 'Published', width: 'w-40' },
		{ key: 'expiresAt', header: 'Expires', width: 'w-40' },
		{ key: 'source', header: 'Source', width: 'w-44' }
	];

	type SeverityVariant = 'info' | 'warning' | 'danger';
	const severityVariant: Record<Row['severity'], SeverityVariant> = {
		info: 'info',
		warning: 'warning',
		critical: 'danger'
	};

	let actionLoading: Record<string, boolean> = {};
	let markAllLoading = false;
	let infoModalOpen = false;

	function rowKey(row: Row): string {
		return row.source === 'profilarr' ? `profilarr:${row.id}` : `pcd:${row.databaseId}:${row.id}`;
	}

	$: visibleUnreadCount = visibleRows.filter((r) => r.readAt === null).length;

	async function toggleRead(row: Row, nextRead: boolean) {
		const key = rowKey(row);
		actionLoading = { ...actionLoading, [key]: true };
		try {
			const body = new FormData();
			body.set('id', row.id);
			body.set('source', row.source);
			if (row.source === 'pcd' && row.databaseId !== null) {
				body.set('databaseId', String(row.databaseId));
			}
			await fetch(`?/${nextRead ? 'markRead' : 'markUnread'}`, {
				method: 'POST',
				body,
				headers: { 'x-sveltekit-action': 'true' }
			});
			await invalidateAll();
		} finally {
			actionLoading = { ...actionLoading, [key]: false };
		}
	}

	async function markAllVisibleRead() {
		const targets = visibleRows
			.filter((r) => r.readAt === null)
			.map((r) => ({
				source: r.source,
				id: r.id,
				databaseId: r.source === 'pcd' ? r.databaseId : null
			}));
		if (targets.length === 0) return;

		markAllLoading = true;
		try {
			const body = new FormData();
			body.set('targets', JSON.stringify(targets));
			await fetch('?/markReadMany', {
				method: 'POST',
				body,
				headers: { 'x-sveltekit-action': 'true' }
			});
			await invalidateAll();
			alertStore.add('success', `Marked ${targets.length} as read`);
		} finally {
			markAllLoading = false;
		}
	}
</script>

<div class="p-4 md:p-8">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-neutral-900 md:text-3xl dark:text-neutral-50">
			Announcements
		</h1>
		<p class="mt-3 text-base text-neutral-600 md:text-lg dark:text-neutral-400">
			Messages from the Profilarr team and your linked databases. Expand a row to read it.
		</p>
	</div>

	<ActionsBar>
		<SearchAction {searchStore} placeholder="Search announcements..." responsive />

		<!-- Mark all visible as read -->
		<Tooltip
			text={visibleUnreadCount > 0
				? `Mark ${visibleUnreadCount} visible as read`
				: 'Nothing to mark'}
		>
			<ActionButton icon={MailCheck} disabled={markAllLoading} on:click={markAllVisibleRead} />
		</Tooltip>

		<!-- Sort -->
		<ActionButton icon={ArrowDownUp} hasDropdown={true} dropdownPosition="right">
			<svelte:fragment slot="dropdown" let:dropdownPosition>
				<Dropdown position={dropdownPosition} minWidth="14rem">
					<DropdownHeader label="Sort announcements by" />
					{#each sortOptions as option}
						<DropdownItem
							label={option.label}
							selected={sortKey === option.key}
							on:click={() => (sortKey = option.key)}
						/>
					{/each}
				</Dropdown>
			</svelte:fragment>
		</ActionButton>

		<!-- Source Filter -->
		<ActionButton icon={Filter} hasDropdown={true} dropdownPosition="right">
			<svelte:fragment slot="dropdown" let:dropdownPosition>
				<Dropdown position={dropdownPosition} minWidth="14rem">
					<DropdownHeader label="Show announcements from" />
					<DropdownItem
						label="Profilarr"
						selected={enabledSources.has('profilarr')}
						on:click={() => toggleSource('profilarr')}
					/>
					{#if pcdSources.length > 0}
						<DropdownHeader label="Linked databases" />
						{#each pcdSources as [id, name]}
							<DropdownItem
								label={name}
								selected={enabledSources.has(`pcd:${id}`)}
								on:click={() => toggleSource(`pcd:${id}`)}
							/>
						{/each}
					{/if}
				</Dropdown>
			</svelte:fragment>
		</ActionButton>

		<!-- Info -->
		<Tooltip text="About">
			<ActionButton icon={Info} on:click={() => (infoModalOpen = true)} />
		</Tooltip>
	</ActionsBar>

	<div class="mt-6">
		<ExpandableTable
			{columns}
			data={visibleRows}
			getRowId={rowKey}
			emptyMessage="No announcements match the current filters."
			responsive
			flushExpanded
			chevronPosition="right"
		>
			<svelte:fragment slot="cell" let:row let:column>
				{#if column.key === 'source'}
					<span
						class="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400"
						title={row.source === 'profilarr' ? 'Profilarr team' : (row.databaseName ?? '')}
					>
						{#if row.source === 'profilarr'}
							<img src={logo} alt="" class="h-5 w-5 flex-shrink-0" />
							<span class="truncate">Profilarr</span>
						{:else if row.databaseRepoUrl}
							<DatabaseAvatar
								name={row.databaseName ?? ''}
								repoUrl={row.databaseRepoUrl}
								size="xs"
							/>
							<span class="truncate">{row.databaseName ?? '(unknown)'}</span>
						{:else}
							<Database class="h-3.5 w-3.5 flex-shrink-0" />
							<span class="truncate">{row.databaseName ?? '(unknown)'}</span>
						{/if}
					</span>
				{:else if column.key === 'title'}
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
				{:else if column.key === 'expiresAt'}
					<span class="text-xs text-neutral-500 dark:text-neutral-500">
						{#if row.expiresAt}
							<DateTime value={row.expiresAt} date />
						{/if}
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
						loading={actionLoading[rowKey(row)]}
						disabled={actionLoading[rowKey(row)]}
						on:click={() => toggleRead(row, false)}
					/>
				{:else}
					<Button
						icon={Eye}
						size="xs"
						variant="secondary"
						ariaLabel="Mark as read"
						tooltip="Mark as read"
						loading={actionLoading[rowKey(row)]}
						disabled={actionLoading[rowKey(row)]}
						on:click={() => toggleRead(row, true)}
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
</div>

<InfoModal bind:open={infoModalOpen} header="About Announcements">
	<div class="space-y-4 text-sm text-neutral-700 dark:text-neutral-300">
		<section>
			<h3 class="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">What's in here?</h3>
			<p>
				Announcements come from two places. <strong>Profilarr</strong> messages are posted by the
				Profilarr team and reach every instance via the public bulletin. <strong>Database</strong>
				messages are written by the maintainers of the PCDs you have linked and travel with the database
				itself.
			</p>
		</section>

		<section>
			<h3 class="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Read state</h3>
			<p>
				Read state is tracked per announcement on this instance. Use the eye icon on a row to flip
				it, or "Mark visible as read" to clear out everything currently in view (filters and search
				apply).
			</p>
		</section>

		<section>
			<h3 class="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Severity</h3>
			<p>
				<strong>Info</strong> is general news.
				<strong>Warning</strong> means something needs attention soon.
				<strong>Critical</strong> is a heads-up for action that probably can't wait.
			</p>
		</section>
	</div>
</InfoModal>
