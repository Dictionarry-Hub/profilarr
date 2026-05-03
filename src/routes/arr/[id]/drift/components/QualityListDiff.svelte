<script lang="ts">
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Label from '$ui/label/Label.svelte';
	import type { Column } from '$ui/table/types';
	import type { DriftDisplayQualityItem } from '$shared/drift.ts';

	export let items: DriftDisplayQualityItem[] = [];

	interface QualityRow extends DriftDisplayQualityItem {
		position: number;
	}

	$: rows = items.map<QualityRow>((item, index) => ({ ...item, position: index + 1 }));

	const columns: Column<QualityRow>[] = [
		{ key: 'position', header: '#', width: 'w-12' },
		{ key: 'name', header: 'Quality / Group' }
	];

	function disableExpand(row: QualityRow): boolean {
		return row.type !== 'group' || !row.items || row.items.length === 0;
	}

	function rowKey(row: QualityRow): string {
		return `${row.type}:${row.id}:${row.position}`;
	}
</script>

<ExpandableTable
	{columns}
	data={rows}
	getRowId={rowKey}
	disableExpandWhen={disableExpand}
	compact
	chevronPosition="right"
	emptyMessage="No qualities"
>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'position'}
			<span class="text-sm text-neutral-500 tabular-nums dark:text-neutral-400">
				{row.position}
			</span>
		{:else if column.key === 'name'}
			<div class="flex items-center justify-between gap-2">
				<span
					class="text-sm font-medium {row.allowed
						? 'text-neutral-900 dark:text-neutral-100'
						: 'text-neutral-400 line-through dark:text-neutral-500'}"
				>
					{row.name}
				</span>
				<div class="flex shrink-0 items-center gap-1.5">
					<Label variant={row.allowed ? 'success' : 'secondary'} size="sm" rounded="md">
						{row.allowed ? 'Enabled' : 'Disabled'}
					</Label>
					{#if row.upgradeUntil}
						<Label variant="info" size="sm" rounded="md">Upgrade Until</Label>
					{/if}
				</div>
			</div>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="expanded" let:row>
		{#if row.type === 'group' && row.items}
			<div class="space-y-2 text-sm">
				{#each row.items as member}
					<div class="flex items-center justify-between gap-2">
						<span class="font-medium text-neutral-700 dark:text-neutral-200">
							{member.name}
						</span>
						{#if member.upgradeUntil}
							<Label variant="info" size="sm" rounded="md">Upgrade Until</Label>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</svelte:fragment>
</ExpandableTable>
