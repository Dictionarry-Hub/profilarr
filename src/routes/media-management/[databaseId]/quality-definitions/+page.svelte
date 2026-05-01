<script lang="ts">
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import CloneModal from '$ui/modal/CloneModal.svelte';
	import TableView from './views/TableView.svelte';
	import CardView from './views/CardView.svelte';
	import { createDataPageStore } from '$lib/client/stores/dataPage';
	import { goto } from '$app/navigation';
	import { alertStore } from '$alerts/store';
	import { Plus } from 'lucide-svelte';
	import type { EntityType } from '$shared/pcd/portable.ts';
	import type { PageData } from './$types';
	import { mediaManagementLockedMessage } from '../lock';
	import { copyToClipboard } from '$lib/client/utils/clipboard';

	export let data: PageData;

	let cloneModalOpen = false;
	let cloneSourceName = '';
	let cloneEntityType: EntityType = 'radarr_quality_definitions';

	function notifyLocked() {
		alertStore.add('info', mediaManagementLockedMessage);
	}

	function handleClone(event: CustomEvent<{ name: string; arr_type: string }>) {
		if (!data.canWriteToBase) {
			notifyLocked();
			return;
		}
		cloneSourceName = event.detail.name;
		cloneEntityType = `${event.detail.arr_type}_quality_definitions` as EntityType;
		cloneModalOpen = true;
	}

	async function handleExport(event: CustomEvent<{ name: string; arr_type: string }>) {
		const { name, arr_type } = event.detail;
		try {
			const params = new URLSearchParams({
				entityType: `${arr_type}_quality_definitions`,
				name
			});
			const res = await fetch(`/databases/${data.currentDatabase.id}/export?${params}`);
			const json = await res.json();
			if (!res.ok) {
				alertStore.add('error', json.error || 'Export failed');
				return;
			}
			const copied = await copyToClipboard(JSON.stringify(json, null, 2));
			if (!copied) {
				alertStore.add('error', 'Failed to copy to clipboard');
				return;
			}
			alertStore.add('success', `Copied "${name}" to clipboard`);
		} catch {
			alertStore.add('error', 'Export failed');
		}
	}

	// Initialize data page store
	const { search, view, filtered, setItems } = createDataPageStore(data.qualityDefinitionsConfigs, {
		storageKey: 'qualityDefinitionsView',
		searchKeys: ['name'],
		searchKey: `qualityDefinitionsConfigsSearch:${data.currentDatabase.id}`
	});

	// Update items when data changes
	$: setItems(data.qualityDefinitionsConfigs);
</script>

<!-- Actions Bar -->
<ActionsBar>
	<SearchAction searchStore={search} placeholder="Search quality definitions..." responsive />
	{#if data.canWriteToBase}
		<ActionButton icon={Plus} hasDropdown={true} dropdownPosition="right">
			<svelte:fragment slot="dropdown" let:dropdownPosition>
				<Dropdown position={dropdownPosition} minWidth="10rem">
					<DropdownHeader label="New config" />
					<DropdownItem
						label="Radarr"
						on:click={() =>
							goto(
								`/media-management/${data.currentDatabase.id}/quality-definitions/new?arrType=radarr`
							)}
					/>
					<DropdownItem
						label="Sonarr"
						on:click={() =>
							goto(
								`/media-management/${data.currentDatabase.id}/quality-definitions/new?arrType=sonarr`
							)}
					/>
				</Dropdown>
			</svelte:fragment>
		</ActionButton>
	{:else}
		<ActionButton icon={Plus} on:click={notifyLocked} />
	{/if}
	<ViewToggle bind:value={$view} />
</ActionsBar>

<!-- Quality Definitions Content -->
<div class="mt-6">
	{#if data.qualityDefinitionsConfigs.length === 0}
		<div
			class="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900"
		>
			<p class="text-neutral-600 dark:text-neutral-400">
				No quality definitions configs found for {data.currentDatabase?.name}
			</p>
		</div>
	{:else if $filtered.length === 0}
		<div
			class="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900"
		>
			<p class="text-neutral-600 dark:text-neutral-400">
				No quality definitions configs match your search
			</p>
		</div>
	{:else if $view === 'table'}
		<TableView
			configs={$filtered}
			databaseId={data.currentDatabase.id}
			canWriteToBase={data.canWriteToBase}
			on:clone={handleClone}
			on:export={handleExport}
		/>
	{:else}
		<CardView
			configs={$filtered}
			databaseId={data.currentDatabase.id}
			canWriteToBase={data.canWriteToBase}
			on:clone={handleClone}
			on:export={handleExport}
		/>
	{/if}
</div>

<CloneModal
	bind:open={cloneModalOpen}
	databaseId={data.currentDatabase.id}
	entityType={cloneEntityType}
	sourceName={cloneSourceName}
	existingNames={data.qualityDefinitionsConfigs.map((c) => c.name)}
	canWriteToBase={data.canWriteToBase}
/>
