<script lang="ts">
	import { Server, Plus, Info } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import EmptyState from '$ui/state/EmptyState.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import TableView from './views/TableView.svelte';
	import CardView from './views/CardView.svelte';
	import { createDataPageStore } from '$lib/client/stores/dataPage';
	import { alertStore } from '$alerts/store';
	import type { PageData } from './$types';
	import type { ArrInstancePublic } from '$db/queries/arrInstances.ts';

	export let data: PageData;

	// Initialize data page store
	const { search, view, filtered, setItems } = createDataPageStore(data.instances, {
		storageKey: 'arrInstancesView',
		searchKeys: ['name', 'url', 'type']
	});

	// Update items when data changes
	$: setItems(data.instances);

	// Modal state
	let showDeleteModal = false;
	let showInfoModal = false;
	let selectedInstance: ArrInstancePublic | null = null;
	let deleteFormElement: HTMLFormElement;

	// Handle delete from view components
	function handleDelete(event: CustomEvent<ArrInstancePublic>) {
		selectedInstance = event.detail;
		showDeleteModal = true;
	}
</script>

<svelte:head>
	<title>Arr Instances - Profilarr</title>
</svelte:head>

{#if data.instances.length === 0}
	<EmptyState
		icon={Server}
		title="No Arr Instances"
		description="Add a Radarr or Sonarr instance to get started."
		buttonText="Add Instance"
		buttonHref="/arr/new"
		buttonIcon={Plus}
	/>
{:else}
	<div class="space-y-6 p-4 sm:p-8">
		<!-- Actions Bar -->
		<ActionsBar>
			<SearchAction searchStore={search} placeholder="Search instances..." />
			<ActionButton icon={Plus} title="Add Instance" on:click={() => goto('/arr/new')} />
			<ActionButton icon={Info} title="Info" on:click={() => (showInfoModal = true)} />
			<ViewToggle bind:value={$view} />
		</ActionsBar>

		<!-- Content -->
		<div class="mt-6">
			{#if $filtered.length === 0}
				<div
					class="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900"
				>
					<p class="text-neutral-600 dark:text-neutral-400">No instances match your search</p>
				</div>
			{:else if $view === 'table'}
				<TableView instances={$filtered} on:delete={handleDelete} />
			{:else}
				<CardView instances={$filtered} on:delete={handleDelete} />
			{/if}
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
<Modal
	open={showDeleteModal}
	header="Delete Instance"
	bodyMessage={`Are you sure you want to delete "${selectedInstance?.name}"? This action cannot be undone.`}
	confirmText="Delete"
	cancelText="Cancel"
	confirmDanger={true}
	on:confirm={() => {
		showDeleteModal = false;
		if (selectedInstance) {
			deleteFormElement?.requestSubmit();
		}
	}}
	on:cancel={() => {
		showDeleteModal = false;
		selectedInstance = null;
	}}
/>

<!-- Hidden delete form -->
<form
	bind:this={deleteFormElement}
	method="POST"
	action="?/delete"
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'failure' && result.data) {
				alertStore.add(
					'error',
					(result.data as { error?: string }).error || 'Failed to delete instance'
				);
			} else if (result.type === 'redirect') {
				alertStore.add('success', 'Instance deleted successfully');
			}
			await update();
			selectedInstance = null;
		};
	}}
>
	<input type="hidden" name="id" value={selectedInstance?.id || ''} />
</form>

<!-- Info Modal -->
<InfoModal bind:open={showInfoModal} header="Arr Instances">
	<div class="space-y-4 text-sm text-neutral-600 dark:text-neutral-400">
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">What are Arr Instances?</div>
			<div class="mt-1">
				Arr instances are your Radarr and Sonarr applications. Profilarr connects to these instances
				to sync quality profiles, custom formats, and other configurations.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Adding an Instance</div>
			<div class="mt-1">
				To add an instance, you'll need the URL and API key from your Radarr or Sonarr application.
				You can find the API key in Settings → General → Security.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Syncing</div>
			<div class="mt-1">
				Once connected, you can configure sync settings to push profiles and formats from your
				linked databases to each instance. Sync can be triggered manually, on a schedule, or
				automatically when changes are detected.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Enabled/Disabled</div>
			<div class="mt-1">
				Disabled instances are excluded from sync operations but remain configured. This is useful
				for temporarily pausing sync without removing the instance.
			</div>
		</div>
	</div>
</InfoModal>
