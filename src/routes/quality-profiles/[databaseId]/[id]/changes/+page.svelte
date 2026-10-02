<script lang="ts">
	import { page } from '$app/stores';
	import History from '@lucide/svelte/icons/history';
	import Badge from '$ui/badge/Badge.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import EmptyState from '$ui/state/EmptyState.svelte';
	import Table from '$ui/table/Table.svelte';
	import type { Column } from '$ui/table/types.ts';
	import type { PageData } from './$types';

	export let data: PageData;

	type Row = PageData['localChanges']['rows'][number];

	const FIELD_LABELS: Record<string, string> = {
		upgrades_allowed: 'Upgrades allowed',
		minimum_custom_format_score: 'Minimum custom format score',
		upgrade_until_score: 'Upgrade until score',
		upgrade_score_increment: 'Upgrade score increment'
	};

	const STATUS: Record<
		Row['status'],
		{ label: string; variant: 'neutral' | 'warning' | 'info' | 'accent' }
	> = {
		applied: { label: 'Applied', variant: 'neutral' },
		pending: { label: 'Not applied', variant: 'warning' },
		overridden: { label: 'Re-applied', variant: 'info' },
		related: { label: 'Related change', variant: 'accent' }
	};

	const columns: Column<Row>[] = [
		{ key: 'setting', header: 'Setting', align: 'left' },
		{ key: 'arr', header: 'App', align: 'left', width: 'w-28' },
		{ key: 'upstream', header: 'Upstream', align: 'right', width: 'w-32' },
		{ key: 'current', header: 'Yours', align: 'right', width: 'w-32' },
		{ key: 'status', header: 'Status', align: 'left', width: 'w-64' }
	];

	$: changes = data.localChanges;
	$: pendingCount = changes.rows.filter((r) => r.status === 'pending').length;
	$: scoringHref = `/quality-profiles/${$page.params.databaseId}/${$page.params.id}/scoring`;

	function settingName(row: Row): string {
		if (row.field !== 'custom_format_score') return FIELD_LABELS[row.field] ?? row.field;
		return row.customFormat?.currentName ?? row.customFormat?.upstreamName ?? '';
	}

	/** Shown under a renamed custom format: the name upstream knows it by. */
	function renamedFrom(row: Row): string | null {
		const cf = row.customFormat;
		if (!cf?.upstreamName || !cf.currentName || cf.upstreamName === cf.currentName) return null;
		return cf.upstreamName;
	}

	function display(value: Row['upstream']): string {
		if (value === null || value === undefined) return '—';
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		return String(value);
	}
</script>

<PageMeta title={`${data.profileName} · Changes`} />

<div class="mt-6 space-y-4">
	{#if changes.snapshot === 'unavailable'}
		<div
			class="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
		>
			Local changes can't be shown right now: the upstream snapshot for this profile failed during
			the last compile. The logs have the details.
		</div>
	{:else if changes.rows.length === 0}
		<EmptyState
			icon={History}
			title="No local changes"
			description="This profile matches the database."
			buttonText="Back to Scoring"
			buttonHref={scoringHref}
		/>
	{:else}
		<p class="text-sm text-neutral-600 dark:text-neutral-400">
			{changes.rows.length} local change{changes.rows.length === 1 ? '' : 's'} compared with the database
			{#if pendingCount > 0}
				· <span class="font-medium text-amber-700 dark:text-amber-400"
					>{pendingCount} not applied</span
				>
			{/if}
			{#if changes.status === 'created'}
				· created locally, not in the database
			{/if}
		</p>

		<Table {columns} data={changes.rows} hoverable={false}>
			<svelte:fragment slot="cell" let:row let:column>
				{#if column.key === 'setting'}
					<div class="font-medium">{settingName(row)}</div>
					{#if renamedFrom(row)}
						<div class="text-xs text-neutral-500 dark:text-neutral-400">
							renamed from {renamedFrom(row)}
						</div>
					{/if}
				{:else if column.key === 'arr'}
					{#if row.arrType === 'radarr' || row.arrType === 'sonarr'}
						<Badge variant={row.arrType}>{row.arrType === 'radarr' ? 'Radarr' : 'Sonarr'}</Badge>
					{:else}
						<span class="text-neutral-500 dark:text-neutral-400">—</span>
					{/if}
				{:else if column.key === 'upstream'}
					<span class="font-mono text-neutral-600 dark:text-neutral-400"
						>{display(row.upstream)}</span
					>
				{:else if column.key === 'current'}
					<span class="font-mono font-semibold">{display(row.current)}</span>
				{:else if column.key === 'status'}
					<div class="flex flex-col items-start gap-1">
						<Badge variant={STATUS[row.status].variant}>{STATUS[row.status].label}</Badge>
						{#if row.status === 'pending'}
							<span class="text-xs text-neutral-500 dark:text-neutral-400">
								wanted {display(row.pendingValue ?? null)}
							</span>
						{/if}
					</div>
				{/if}
			</svelte:fragment>
		</Table>
	{/if}
</div>
