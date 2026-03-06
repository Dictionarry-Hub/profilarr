<script lang="ts">
	import Table from '$ui/table/Table.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import type { Column } from '$ui/table/types';
	import type { OrderedItem } from '$shared/pcd/display';
	import type { OperationType } from './types';

	export let beforeItems: OrderedItem[] = [];
	export let afterItems: OrderedItem[] = [];
	export let operation: OperationType = 'update';

	const columns: Column<OrderedItem>[] = [
		{ key: 'position', header: 'Pos', width: 'w-14' },
		{ key: 'name', header: 'Name' }
	];

	function formatTitle(value: string): string {
		const trimmed = value.replace(/[_-]+/g, ' ').trim();
		return trimmed.replace(/\b\w/g, (char) => char.toUpperCase());
	}

	function getPositionOffset(items: OrderedItem[]): number {
		if (!items || items.length === 0) return 0;
		const minPosition = items.reduce(
			(min, item) => Math.min(min, item.position),
			items[0].position
		);
		return minPosition === 0 ? 1 : 0;
	}

	function formatPosition(position: number, offset: number): number {
		return position + offset;
	}

	$: beforeOffset = getPositionOffset(beforeItems);
	$: afterOffset = getPositionOffset(afterItems);
</script>

{#if operation === 'create'}
	<div class="space-y-2">
		<div class="text-sm font-medium text-neutral-500 dark:text-neutral-400">Value</div>
		<Table {columns} data={afterItems} compact hoverable={false} emptyMessage="—" responsive>
			<svelte:fragment slot="cell" let:row let:column>
				{#if column.key === 'position'}
					<Badge variant="neutral" size="md" mono>
						{formatPosition(row.position, afterOffset)}
					</Badge>
				{:else if column.key === 'name'}
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
							{row.name}
						</span>
						<div class="flex flex-wrap gap-1">
							<Badge variant="neutral" size="md">{formatTitle(row.type)}</Badge>
							<Badge variant={row.enabled ? 'success' : 'neutral'} size="md">
								{row.enabled ? 'Enabled' : 'Disabled'}
							</Badge>
							{#if row.upgradeUntil}
								<Badge variant="info" size="md">Upgrade Until</Badge>
							{/if}
							{#if row.members && row.members.length > 0}
								<Badge variant="neutral" size="md">
									{row.members.map((member) => member.name).join(', ')}
								</Badge>
							{/if}
						</div>
					</div>
				{/if}
			</svelte:fragment>
		</Table>
	</div>
{:else if operation === 'delete'}
	<div class="space-y-2">
		<div class="text-sm font-medium text-neutral-500 dark:text-neutral-400">Value</div>
		<Table {columns} data={beforeItems} compact hoverable={false} emptyMessage="—" responsive>
			<svelte:fragment slot="cell" let:row let:column>
				{#if column.key === 'position'}
					<Badge variant="neutral" size="md" mono>
						{formatPosition(row.position, beforeOffset)}
					</Badge>
				{:else if column.key === 'name'}
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
							{row.name}
						</span>
						<div class="flex flex-wrap gap-1">
							<Badge variant="neutral" size="md">{formatTitle(row.type)}</Badge>
							<Badge variant={row.enabled ? 'success' : 'neutral'} size="md">
								{row.enabled ? 'Enabled' : 'Disabled'}
							</Badge>
							{#if row.upgradeUntil}
								<Badge variant="info" size="md">Upgrade Until</Badge>
							{/if}
							{#if row.members && row.members.length > 0}
								<Badge variant="neutral" size="md">
									{row.members.map((member) => member.name).join(', ')}
								</Badge>
							{/if}
						</div>
					</div>
				{/if}
			</svelte:fragment>
		</Table>
	</div>
{:else}
	<div class="grid gap-4 md:grid-cols-2">
		<div class="space-y-2">
			<div class="text-sm font-medium text-neutral-500 dark:text-neutral-400">Before</div>
			<Table {columns} data={beforeItems} compact hoverable={false} emptyMessage="—" responsive>
				<svelte:fragment slot="cell" let:row let:column>
					{#if column.key === 'position'}
						<Badge variant="neutral" size="md" mono>
							{formatPosition(row.position, beforeOffset)}
						</Badge>
					{:else if column.key === 'name'}
						<div class="flex flex-wrap items-center gap-2">
							<span class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
								{row.name}
							</span>
							<div class="flex flex-wrap gap-1">
								<Badge variant="neutral" size="md">{formatTitle(row.type)}</Badge>
								<Badge variant={row.enabled ? 'success' : 'neutral'} size="md">
									{row.enabled ? 'Enabled' : 'Disabled'}
								</Badge>
								{#if row.upgradeUntil}
									<Badge variant="info" size="md">Upgrade Until</Badge>
								{/if}
								{#if row.members && row.members.length > 0}
									<Badge variant="neutral" size="md">
										{row.members.map((member) => member.name).join(', ')}
									</Badge>
								{/if}
							</div>
						</div>
					{/if}
				</svelte:fragment>
			</Table>
		</div>
		<div class="space-y-2">
			<div class="text-sm font-medium text-neutral-500 dark:text-neutral-400">After</div>
			<Table {columns} data={afterItems} compact hoverable={false} emptyMessage="—" responsive>
				<svelte:fragment slot="cell" let:row let:column>
					{#if column.key === 'position'}
						<Badge variant="neutral" size="md" mono>
							{formatPosition(row.position, afterOffset)}
						</Badge>
					{:else if column.key === 'name'}
						<div class="flex flex-wrap items-center gap-2">
							<span class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
								{row.name}
							</span>
							<div class="flex flex-wrap gap-1">
								<Badge variant="neutral" size="md">{formatTitle(row.type)}</Badge>
								<Badge variant={row.enabled ? 'success' : 'neutral'} size="md">
									{row.enabled ? 'Enabled' : 'Disabled'}
								</Badge>
								{#if row.upgradeUntil}
									<Badge variant="info" size="md">Upgrade Until</Badge>
								{/if}
								{#if row.members && row.members.length > 0}
									<Badge variant="neutral" size="md">
										{row.members.map((member) => member.name).join(', ')}
									</Badge>
								{/if}
							</div>
						</div>
					{/if}
				</svelte:fragment>
			</Table>
		</div>
	</div>
{/if}
