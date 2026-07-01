<script lang="ts">
	import Table from '$ui/table/Table.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import type { Column } from '$ui/table/types';
	import type { CustomFormatScoreDiff, OperationType } from './types';
	import radarrLogo from '$lib/client/assets/Radarr.svg';
	import sonarrLogo from '$lib/client/assets/Sonarr.svg';

	export let rows: CustomFormatScoreDiff[] = [];
	export let operation: OperationType = 'update';

	$: columns = getColumns(operation);

	function formatTitle(value: string): string {
		const trimmed = value.replace(/[_-]+/g, ' ').trim();
		return trimmed.replace(/\b\w/g, (char) => char.toUpperCase());
	}

	function formatValue(value: number | null): string {
		return value === null ? '—' : String(value);
	}

	function getColumns(nextOperation: OperationType): Column<CustomFormatScoreDiff>[] {
		switch (nextOperation) {
			case 'create':
				return [
					{ key: 'custom_format_name', header: 'Custom Format' },
					{ key: 'arr_type', header: 'Arr', width: 'w-20' },
					{ key: 'after', header: 'Value', width: 'w-24' }
				];
			case 'delete':
				return [
					{ key: 'custom_format_name', header: 'Custom Format' },
					{ key: 'arr_type', header: 'Arr', width: 'w-20' },
					{ key: 'before', header: 'Value', width: 'w-24' }
				];
			default:
				return [
					{ key: 'custom_format_name', header: 'Custom Format' },
					{ key: 'arr_type', header: 'Arr', width: 'w-20' },
					{ key: 'before', header: 'Before', width: 'w-24' },
					{ key: 'after', header: 'After', width: 'w-24' }
				];
		}
	}
</script>

<Table {columns} data={rows} compact hoverable={false} responsive>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'custom_format_name'}
			<span class="text-sm text-text-soft">
				{row.custom_format_name}
			</span>
		{:else if column.key === 'arr_type'}
			{#if row.arr_type === 'radarr'}
				<img src={radarrLogo} alt="Radarr" class="h-5 w-5" />
			{:else if row.arr_type === 'sonarr'}
				<img src={sonarrLogo} alt="Sonarr" class="h-5 w-5" />
			{:else}
				<span class="text-sm text-text-muted">
					{formatTitle(row.arr_type)}
				</span>
			{/if}
		{:else if column.key === 'before'}
			{#if row.before === null}
				<span class="text-sm text-text-subtle">—</span>
			{:else}
				<Badge variant="neutral" size="md" mono>{formatValue(row.before)}</Badge>
			{/if}
		{:else if column.key === 'after'}
			{#if row.after === null}
				<span class="text-sm text-text-subtle">—</span>
			{:else}
				<Badge variant="neutral" size="md" mono>{formatValue(row.after)}</Badge>
			{/if}
		{/if}
	</svelte:fragment>
</Table>
