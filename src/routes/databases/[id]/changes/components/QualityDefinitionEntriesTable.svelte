<script lang="ts">
	import Table from '$ui/table/Table.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import type { Column } from '$ui/table/types';
	import type { QualityDefinitionEntry, OperationType } from './types';

	export let beforeEntries: QualityDefinitionEntry[] = [];
	export let afterEntries: QualityDefinitionEntry[] = [];
	export let operation: OperationType = 'update';

	const columns: Column<QualityDefinitionEntry>[] = [
		{ key: 'quality_name', header: 'Quality' },
		{ key: 'min_size', header: 'Min', width: 'w-24' },
		{ key: 'preferred_size', header: 'Preferred', width: 'w-28' },
		{ key: 'max_size', header: 'Max', width: 'w-24' }
	];

	function formatValue(value: number | null | undefined): string {
		if (value === null || value === undefined) return '—';
		return String(value);
	}

	function isUnlimitedColumn(columnKey: string): boolean {
		return columnKey === 'preferred_size' || columnKey === 'max_size';
	}

	function renderSizeBadge(value: number | null | undefined, columnKey: string) {
		if (value === null || value === undefined) {
			return { text: '—', mono: false };
		}

		if (value === 0 && isUnlimitedColumn(columnKey)) {
			return { text: 'Unlimited', mono: false };
		}

		return { text: formatValue(value), mono: true };
	}

	$: valueEntries =
		operation === 'delete'
			? beforeEntries.length > 0
				? beforeEntries
				: afterEntries
			: afterEntries;
</script>

{#if operation === 'create' || operation === 'delete'}
	<div class="space-y-2">
		<div class="text-sm font-medium text-text-muted">Value</div>
		<Table {columns} data={valueEntries} compact hoverable={false} emptyMessage="—" responsive>
			<svelte:fragment slot="cell" let:row let:column>
				{#if column.key === 'quality_name'}
					<span class="text-sm text-text-soft">{row.quality_name}</span>
				{:else if column.key === 'min_size'}
					{@const display = renderSizeBadge(row.min_size, column.key)}
					<Badge variant="neutral" size="md" mono={display.mono}>{display.text}</Badge>
				{:else if column.key === 'preferred_size'}
					{@const display = renderSizeBadge(row.preferred_size, column.key)}
					<Badge variant="neutral" size="md" mono={display.mono}>{display.text}</Badge>
				{:else if column.key === 'max_size'}
					{@const display = renderSizeBadge(row.max_size, column.key)}
					<Badge variant="neutral" size="md" mono={display.mono}>{display.text}</Badge>
				{/if}
			</svelte:fragment>
		</Table>
	</div>
{:else}
	<div class="grid gap-4 md:grid-cols-2">
		<div class="space-y-2">
			<div class="text-sm font-medium text-text-muted">Before</div>
			<Table {columns} data={beforeEntries} compact hoverable={false} emptyMessage="—" responsive>
				<svelte:fragment slot="cell" let:row let:column>
					{#if column.key === 'quality_name'}
						<span class="text-sm text-text-soft">{row.quality_name}</span>
					{:else if column.key === 'min_size'}
						{@const display = renderSizeBadge(row.min_size, column.key)}
						<Badge variant="neutral" size="md" mono={display.mono}>{display.text}</Badge>
					{:else if column.key === 'preferred_size'}
						{@const display = renderSizeBadge(row.preferred_size, column.key)}
						<Badge variant="neutral" size="md" mono={display.mono}>{display.text}</Badge>
					{:else if column.key === 'max_size'}
						{@const display = renderSizeBadge(row.max_size, column.key)}
						<Badge variant="neutral" size="md" mono={display.mono}>{display.text}</Badge>
					{/if}
				</svelte:fragment>
			</Table>
		</div>
		<div class="space-y-2">
			<div class="text-sm font-medium text-text-muted">After</div>
			<Table {columns} data={afterEntries} compact hoverable={false} emptyMessage="—" responsive>
				<svelte:fragment slot="cell" let:row let:column>
					{#if column.key === 'quality_name'}
						<span class="text-sm text-text-soft">{row.quality_name}</span>
					{:else if column.key === 'min_size'}
						{@const display = renderSizeBadge(row.min_size, column.key)}
						<Badge variant="neutral" size="md" mono={display.mono}>{display.text}</Badge>
					{:else if column.key === 'preferred_size'}
						{@const display = renderSizeBadge(row.preferred_size, column.key)}
						<Badge variant="neutral" size="md" mono={display.mono}>{display.text}</Badge>
					{:else if column.key === 'max_size'}
						{@const display = renderSizeBadge(row.max_size, column.key)}
						<Badge variant="neutral" size="md" mono={display.mono}>{display.text}</Badge>
					{/if}
				</svelte:fragment>
			</Table>
		</div>
	</div>
{/if}
