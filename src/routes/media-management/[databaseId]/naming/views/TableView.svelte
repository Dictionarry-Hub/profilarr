<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Table from '$ui/table/Table.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import Button from '$ui/button/Button.svelte';
	import type { Column } from '$ui/table/types';
	import { Tag, ToggleRight, Copy, Download } from 'lucide-svelte';
	import type { NamingListItem } from '$shared/pcd/display.ts';
	import radarrLogo from '$lib/client/assets/Radarr.svg';
	import sonarrLogo from '$lib/client/assets/Sonarr.svg';
	import { FEATURES } from '$shared/features.ts';

	export let configs: NamingListItem[];
	export let databaseId: number;

	const dispatch = createEventDispatcher<{
		clone: { name: string; arr_type: string };
		export: { name: string; arr_type: string };
	}>();

	const logos: Record<string, string> = {
		radarr: radarrLogo,
		sonarr: sonarrLogo
	};

	function getRowHref(config: NamingListItem): string {
		return `/media-management/${databaseId}/naming/${config.arr_type}/${encodeURIComponent(config.name)}`;
	}

	const columns: Column<NamingListItem>[] = [
		{
			key: 'name',
			header: 'Name',
			headerIcon: Tag,
			align: 'left',
			sortable: true
		},
		{
			key: 'arr_type',
			header: 'Type',
			sortable: true
		},
		{
			key: 'rename',
			header: 'Rename',
			headerIcon: ToggleRight
		}
	];
</script>

<Table {columns} data={configs} rowHref={getRowHref} hoverable={true}>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'name'}
			<span class="font-medium">{row.name}</span>
		{:else if column.key === 'arr_type'}
			<div class="flex items-center gap-2">
				<img src={logos[row.arr_type]} alt={row.arr_type} class="h-5 w-5" />
			</div>
		{:else if column.key === 'rename'}
			{#if row.rename}
				<Badge variant="success">Enabled</Badge>
			{:else}
				<Badge variant="neutral">Disabled</Badge>
			{/if}
		{/if}
	</svelte:fragment>

	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<svelte:fragment slot="actions" let:row>
		<div class="flex items-center justify-end gap-0.5" on:click|stopPropagation>
			{#if FEATURES.importExport}
				<Button
					icon={Download}
					size="xs"
					variant="ghost"
					tooltip="Export"
					on:click={() => dispatch('export', { name: row.name, arr_type: row.arr_type })}
				/>
			{/if}
			<Button
				icon={Copy}
				size="xs"
				variant="secondary"
				tooltip="Clone"
				on:click={() => dispatch('clone', { name: row.name, arr_type: row.arr_type })}
			/>
		</div>
	</svelte:fragment>
</Table>
