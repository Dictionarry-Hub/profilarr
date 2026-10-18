<script lang="ts">
	import { page } from '$app/stores';
	import History from '@lucide/svelte/icons/history';
	import InlineLink from '$ui/link/InlineLink.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import EmptyState from '$ui/state/EmptyState.svelte';
	import Label from '$ui/label/Label.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import FieldDiffTable from '$ui/table/FieldDiffTable.svelte';
	import Table from '$ui/table/Table.svelte';
	import type { Column } from '$ui/table/types';
	import type { PageData } from './$types';
	import ChangeStatus from './components/ChangeStatus.svelte';

	export let data: PageData;

	type Row = PageData['localChanges']['rows'][number];

	const FIELD_LABELS: Record<string, string> = {
		upgrades_allowed: 'Upgrades Allowed',
		minimum_custom_format_score: 'Minimum Score',
		upgrade_until_score: 'Upgrade Until Score',
		upgrade_score_increment: 'Upgrade Score Increment'
	};

	const ARR_COLORS: Record<string, string> = {
		radarr: 'bg-[var(--arr-radarr-color)] text-neutral-900',
		sonarr: 'bg-[var(--arr-sonarr-color)] text-neutral-900'
	};

	const settingColumns: Column<Row>[] = [
		{ key: 'setting', header: 'Setting', align: 'left' },
		{ key: 'upstream', header: 'Default', align: 'right', width: 'w-32' },
		{ key: 'current', header: 'Yours', align: 'right', width: 'w-32' },
		{ key: 'status', header: 'Status', align: 'left', width: 'w-64' }
	];

	const scoreColumns: Column<Row>[] = [
		{ key: 'format', header: 'Custom Format', align: 'left' },
		{ key: 'arr', header: 'App', align: 'left', width: 'w-28' },
		{ key: 'upstream', header: 'Default', align: 'right', width: 'w-32' },
		{ key: 'current', header: 'Yours', align: 'right', width: 'w-32' },
		{ key: 'status', header: 'Status', align: 'left', width: 'w-64' }
	];

	const CREATED =
		'This profile was created locally, so its scoring has no defaults to compare against.';

	const UNAVAILABLE = {
		database:
			"Local changes can't be shown right now: the last compile couldn't read the defaults for this database. The logs have the details.",
		profile:
			"Local changes can't be shown right now: the last compile couldn't read this profile's defaults. The logs have the details.",
		load: "Local changes couldn't be loaded. The logs have the details."
	};

	type Related = PageData['localChanges']['relatedChanges'][number];

	function relatedHref(change: Related): string | null {
		if (change.id === null) return null;
		const databaseId = $page.params.databaseId;
		return change.entity === 'custom_format'
			? `/custom-formats/${databaseId}/${change.id}/conditions`
			: `/regular-expressions/${databaseId}/${change.id}`;
	}

	const relatedColumns: Column<Related>[] = [
		{ key: 'name', header: 'Name' },
		{ key: 'entity', header: 'Entity', width: 'w-44' },
		{ key: 'change', header: 'Change', width: 'w-64' }
	];

	const isDeleted = (change: Related) => change.changed.includes('deleted');

	$: changes = data.localChanges;
	$: settingRows = changes.rows.filter((r) => r.field !== 'custom_format_score');
	$: scoreRows = changes.rows.filter((r) => r.field === 'custom_format_score');
	$: pendingCount = changes.rows.filter((r) => r.status === 'pending').length;
	$: scoringHref = `/quality-profiles/${$page.params.databaseId}/${$page.params.id}/scoring`;

	function settingName(row: Row): string {
		if (row.field !== 'custom_format_score') return FIELD_LABELS[row.field] ?? row.field;
		return row.customFormat?.currentName ?? row.customFormat?.upstreamName ?? '';
	}

	/** Shown under a renamed custom format: the name it has in the defaults. */
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
			{UNAVAILABLE[changes.unavailableReason ?? 'database']}
		</div>
	{:else if changes.status === 'created' && changes.relatedChanges.length === 0}
		<EmptyState
			icon={History}
			title="Created Locally"
			description={CREATED}
			buttonText="Back to Scoring"
			buttonHref={scoringHref}
		/>
	{:else if changes.status === 'created'}
		<p class="text-sm text-neutral-600 dark:text-neutral-400">{CREATED}</p>
	{:else if changes.rows.length === 0 && changes.relatedChanges.length === 0}
		<EmptyState
			icon={History}
			title="No Local Changes"
			description="Scoring matches its defaults."
			buttonText="Back to Scoring"
			buttonHref={scoringHref}
		/>
	{:else if changes.rows.length > 0}
		<p class="text-sm text-neutral-600 dark:text-neutral-400">
			{changes.rows.length} scoring change{changes.rows.length === 1 ? '' : 's'} compared with the defaults
			{#if pendingCount > 0}
				· <span class="font-medium text-amber-700 dark:text-amber-400"
					>{pendingCount} not applied</span
				>
			{/if}
		</p>

		{#if settingRows.length > 0}
			<section class="space-y-2">
				<h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Settings</h2>
				<Table columns={settingColumns} data={settingRows} hoverable={false} responsive>
					<svelte:fragment slot="cell" let:row let:column>
						{#if column.key === 'setting'}
							<span class="font-medium">{settingName(row)}</span>
						{:else if column.key === 'upstream'}
							<span class="font-mono text-neutral-600 dark:text-neutral-400"
								>{display(row.upstream)}</span
							>
						{:else if column.key === 'current'}
							<span class="font-mono font-semibold">{display(row.current)}</span>
						{:else if column.key === 'status'}
							<ChangeStatus {row} {display} />
						{/if}
					</svelte:fragment>
				</Table>
			</section>
		{/if}

		{#if scoreRows.length > 0}
			<section class="space-y-2">
				<h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Scores</h2>
				<Table columns={scoreColumns} data={scoreRows} hoverable={false} responsive>
					<svelte:fragment slot="cell" let:row let:column>
						{#if column.key === 'format'}
							<div class="font-medium">{settingName(row)}</div>
							{#if renamedFrom(row)}
								<div class="text-xs text-neutral-500 dark:text-neutral-400">
									renamed from {renamedFrom(row)}
								</div>
							{/if}
						{:else if column.key === 'arr'}
							{#if row.arrType === 'radarr' || row.arrType === 'sonarr'}
								<Label customVariant={ARR_COLORS[row.arrType]} size="md" rounded="md">
									{row.arrType === 'radarr' ? 'Radarr' : 'Sonarr'}
								</Label>
							{/if}
						{:else if column.key === 'upstream'}
							<span class="font-mono text-neutral-600 dark:text-neutral-400"
								>{display(row.upstream)}</span
							>
						{:else if column.key === 'current'}
							<span class="font-mono font-semibold">{display(row.current)}</span>
						{:else if column.key === 'status'}
							<ChangeStatus {row} {display} />
						{/if}
					</svelte:fragment>
				</Table>
			</section>
		{/if}
	{/if}

	{#if changes.relatedChanges.length > 0}
		<section class="space-y-2">
			<h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Related Changes</h2>
			<p class="text-sm text-neutral-600 dark:text-neutral-400">
				Changes to custom formats and regexes this profile uses.
			</p>
			<ExpandableTable
				columns={relatedColumns}
				data={changes.relatedChanges}
				getRowId={(row) => `${row.entity}:${row.name}`}
				responsive
				chevronPosition="right"
				primaryColumnKey="name"
				flushExpanded
				disableExpandWhen={(row) => row.details.length === 0}
			>
				<svelte:fragment slot="cell" let:row let:column>
					{#if column.key === 'name'}
						{@const href = relatedHref(row)}
						<div class="flex flex-col gap-0.5">
							<span class="text-sm font-medium">
								{#if href}
									<InlineLink {href} text={row.name} />
								{:else}
									<span
										class="text-neutral-900 dark:text-neutral-100 {isDeleted(row)
											? 'line-through'
											: ''}">{row.name}</span
									>
								{/if}
							</span>
							{#if row.entity === 'regular_expression'}
								<span class="text-xs text-neutral-500 dark:text-neutral-400">
									Used by {row.via.join(', ')}
								</span>
							{/if}
						</div>
					{:else if column.key === 'entity'}
						<Label variant="secondary" size="md" rounded="md">
							{row.entity === 'custom_format' ? 'Custom Format' : 'Regular Expression'}
						</Label>
					{:else if column.key === 'change'}
						<div class="flex flex-wrap items-center gap-1.5">
							<Label variant={isDeleted(row) ? 'danger' : 'secondary'} size="md" rounded="md">
								{row.summary}
							</Label>
							{#if row.pending}
								<Label variant="warning" size="md" rounded="md">Not Applied</Label>
							{/if}
						</div>
					{/if}
				</svelte:fragment>
				<svelte:fragment slot="expanded" let:row>
					<div class="px-4 py-3 md:px-6 md:py-4">
						<FieldDiffTable changes={row.details} expectedLabel="Default" actualLabel="Yours" />
					</div>
				</svelte:fragment>
			</ExpandableTable>
		</section>
	{/if}
</div>
