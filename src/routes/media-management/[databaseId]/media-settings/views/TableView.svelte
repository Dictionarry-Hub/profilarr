<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Table from '$ui/table/Table.svelte';
	import Label from '$ui/label/Label.svelte';
	import Button from '$ui/button/Button.svelte';
	import type { Column } from '$ui/table/types';
	import { Tag, Info, RefreshCw, Copy, Download } from 'lucide-svelte';
	import type { MediaSettingsListItem } from '$shared/pcd/display.ts';
	import radarrLogo from '$lib/client/assets/Radarr.svg';
	import sonarrLogo from '$lib/client/assets/Sonarr.svg';
	import { FEATURES } from '$shared/features.ts';

	export let configs: MediaSettingsListItem[];
	export let databaseId: number;

	const dispatch = createEventDispatcher<{
		clone: { name: string; arr_type: string };
		export: { name: string; arr_type: string };
	}>();

	const logos: Record<string, string> = {
		radarr: radarrLogo,
		sonarr: sonarrLogo
	};

	// Map propers_repacks values to badge variants and labels
	const propersRepacksConfig: Record<
		string,
		{ variant: 'secondary' | 'success' | 'warning'; label: string }
	> = {
		doNotPrefer: { variant: 'secondary', label: 'Do Not Prefer' },
		preferAndUpgrade: { variant: 'success', label: 'Prefer & Upgrade' },
		doNotUpgradeAutomatically: { variant: 'warning', label: 'No Auto Upgrade' }
	};

	function getRowHref(config: MediaSettingsListItem): string {
		return `/media-management/${databaseId}/media-settings/${config.arr_type}/${encodeURIComponent(config.name)}`;
	}

	const columns: Column<MediaSettingsListItem>[] = [
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
			key: 'propers_repacks',
			header: 'Propers & Repacks',
			headerIcon: RefreshCw
		},
		{
			key: 'enable_media_info',
			header: 'Media Info',
			headerIcon: Info
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
		{:else if column.key === 'propers_repacks'}
			{@const config = propersRepacksConfig[row.propers_repacks] || {
				variant: 'secondary',
				label: row.propers_repacks
			}}
			<Label variant={config.variant} size="sm" rounded="md">{config.label}</Label>
		{:else if column.key === 'enable_media_info'}
			{#if row.enable_media_info}
				<Label variant="success" size="sm" rounded="md">Enabled</Label>
			{:else}
				<Label variant="secondary" size="sm" rounded="md">Disabled</Label>
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
