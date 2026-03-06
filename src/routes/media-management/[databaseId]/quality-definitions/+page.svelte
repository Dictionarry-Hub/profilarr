<script lang="ts">
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
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

	export let data: PageData;

	let cloneModalOpen = false;
	let cloneSourceName = '';
	let cloneEntityType: EntityType = 'radarr_quality_definitions';

	function handleClone(event: CustomEvent<{ name: string; arr_type: string }>) {
		cloneSourceName = event.detail.name;
		cloneEntityType = `${event.detail.arr_type}_quality_definitions` as EntityType;
		cloneModalOpen = true;
	}

	async function handleExport(event: CustomEvent<{ name: string; arr_type: string }>) {
		const { name, arr_type } = event.detail;
		try {
			const params = new URLSearchParams({
				databaseId: String(data.currentDatabase.id),
				entityType: `${arr_type}_quality_definitions`,
				name
			});
			const res = await fetch(`/api/v1/pcd/export?${params}`);
			const json = await res.json();
			if (!res.ok) {
				alertStore.add('error', json.error || 'Export failed');
				return;
			}
			await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
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
	<ActionButton
		icon={Plus}
		on:click={() => goto(`/media-management/${data.currentDatabase.id}/quality-definitions/new`)}
	/>
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
			on:clone={handleClone}
			on:export={handleExport}
		/>
	{:else}
		<CardView
			configs={$filtered}
			databaseId={data.currentDatabase.id}
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
