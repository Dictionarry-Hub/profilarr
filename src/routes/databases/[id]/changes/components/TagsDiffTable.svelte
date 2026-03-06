<script lang="ts">
	import Table from '$ui/table/Table.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import type { Column } from '$ui/table/types';
	import type { OperationType } from './types';

	export let removed: string[] = [];
	export let added: string[] = [];
	export let operation: OperationType = 'update';

	$: columns = getColumns(operation);

	function getColumns(
		nextOperation: OperationType
	): Column<{ removed: string[]; added: string[] }>[] {
		switch (nextOperation) {
			case 'create':
				return [{ key: 'added', header: 'Value' }];
			case 'delete':
				return [{ key: 'removed', header: 'Value' }];
			default:
				return [
					{ key: 'removed', header: 'Removed' },
					{ key: 'added', header: 'Added' }
				];
		}
	}
</script>

<Table
	{columns}
	data={[
		{
			removed,
			added
		}
	]}
	compact
	hoverable={false}
	responsive
>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'removed'}
			{#if row.removed.length > 0}
				<div class="flex flex-wrap gap-1">
					{#each row.removed as tag}
						<Badge variant="neutral" size="md">{tag}</Badge>
					{/each}
				</div>
			{:else}
				<span class="text-sm text-neutral-400">—</span>
			{/if}
		{:else if column.key === 'added'}
			{#if row.added.length > 0}
				<div class="flex flex-wrap gap-1">
					{#each row.added as tag}
						<Badge variant="neutral" size="md">{tag}</Badge>
					{/each}
				</div>
			{:else}
				<span class="text-sm text-neutral-400">—</span>
			{/if}
		{/if}
	</svelte:fragment>
</Table>
