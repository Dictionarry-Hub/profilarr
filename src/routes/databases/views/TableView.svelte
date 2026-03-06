<script lang="ts">
	import { ExternalLink, Unlink, Lock, Code } from 'lucide-svelte';
	import Table from '$ui/table/Table.svelte';
	import Button from '$ui/button/Button.svelte';
	import Label from '$ui/label/Label.svelte';
	import type { Column } from '$ui/table/types';
	import type { DatabaseInstancePublic } from '$db/queries/databaseInstances.ts';
	import { parseUTC } from '$shared/utils/dates';
	import { createEventDispatcher } from 'svelte';
	import DatabaseAvatar from '../components/DatabaseAvatar.svelte';

	export let databases: DatabaseInstancePublic[];

	const dispatch = createEventDispatcher<{
		unlink: DatabaseInstancePublic;
	}>();

	// Avatar handled by DatabaseAvatar component

	// Format sync strategy for display
	function formatSyncStrategy(minutes: number): string {
		if (minutes === 0) return 'Manual';
		if (minutes < 60) return `Every ${minutes} min`;
		if (minutes === 60) return 'Hourly';
		if (minutes < 1440) return `Every ${minutes / 60}h`;
		return `Every ${minutes / 1440}d`;
	}

	// Format last synced date
	function formatLastSynced(date: string | null): string {
		const d = parseUTC(date);
		if (!d) return 'Never';
		return d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function getRowHref(database: DatabaseInstancePublic): string {
		return `/databases/${database.id}`;
	}

	// Handle unlink click
	function handleUnlinkClick(e: Event, database: DatabaseInstancePublic) {
		e.stopPropagation();
		e.preventDefault();
		dispatch('unlink', database);
	}

	// Define table columns
	const columns: Column<DatabaseInstancePublic>[] = [
		{ key: 'name', header: 'Name', align: 'left' },
		{ key: 'repository_url', header: 'Repository', align: 'left' },
		{ key: 'sync_strategy', header: 'Sync', align: 'left', width: 'w-32' },
		{ key: 'last_synced_at', header: 'Last Synced', align: 'left', width: 'w-40' }
	];
</script>

<Table {columns} data={databases} hoverable={true} rowHref={getRowHref}>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'name'}
			<div class="flex items-center gap-3">
				<DatabaseAvatar name={row.name} repoUrl={row.repository_url} size="sm" />
				<div class="flex items-center gap-2">
					<div class="font-medium text-neutral-900 dark:text-neutral-50">
						{row.name}
					</div>
					{#if row.is_private}
						<Label variant="secondary" size="sm" rounded="md" mono>
							<Lock size={12} />
							Private
						</Label>
					{/if}
					{#if row.hasPat}
						<Label variant="info" size="sm" rounded="md" mono>
							<Code size={12} />
							Dev
						</Label>
					{/if}
				</div>
			</div>
		{:else if column.key === 'repository_url'}
			<Label variant="secondary" size="sm" rounded="md" mono>
				{row.repository_url.replace('https://github.com/', '')}
			</Label>
		{:else if column.key === 'sync_strategy'}
			<Label variant="secondary" size="sm" rounded="md" mono>
				{formatSyncStrategy(row.sync_strategy)}
			</Label>
		{:else if column.key === 'last_synced_at'}
			<Label variant="secondary" size="sm" rounded="md" mono>
				{formatLastSynced(row.last_synced_at)}
			</Label>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="actions" let:row>
		<div class="relative z-10 flex items-center justify-end gap-1">
			<Button
				icon={ExternalLink}
				size="xs"
				variant="secondary"
				title="View on GitHub"
				ariaLabel="View on GitHub"
				href={row.repository_url}
				target="_blank"
				rel="noopener noreferrer"
			/>
			<Button
				icon={Unlink}
				size="xs"
				title="Unlink database"
				variant="secondary"
				iconColor="text-red-600 dark:text-red-400"
				on:click={(e) => handleUnlinkClick(e, row)}
			/>
		</div>
	</svelte:fragment>
</Table>
