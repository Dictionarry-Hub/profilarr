<script lang="ts">
	import { Database, Plus, Info } from 'lucide-svelte';
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
	import type { DatabaseInstancePublic } from '$db/queries/databaseInstances.ts';

	export let data: PageData;

	// Initialize data page store
	const { search, view, filtered, setItems } = createDataPageStore(data.databases, {
		storageKey: 'databasesView',
		searchKeys: ['name', 'repository_url']
	});

	// Update items when data changes
	$: setItems(data.databases);

	// Modal state
	let showUnlinkModal = false;
	let showInfoModal = false;
	let selectedDatabase: DatabaseInstancePublic | null = null;
	let unlinkFormElement: HTMLFormElement;
	let unlinkLoading = false;

	// Handle unlink from view components
	function handleUnlink(event: CustomEvent<DatabaseInstancePublic>) {
		selectedDatabase = event.detail;
		showUnlinkModal = true;
	}
</script>

<svelte:head>
	<title>Databases - Profilarr</title>
</svelte:head>

{#if data.databases.length === 0}
	<EmptyState
		icon={Database}
		title="No Databases Linked"
		description="Link a Profilarr Compliant Database to get started with profile management."
		buttonText="Link Database"
		buttonHref="/databases/new"
		buttonIcon={Plus}
	/>
{:else}
	<div class="space-y-6 p-4 sm:p-8">
		<!-- Actions Bar -->
		<ActionsBar>
			<SearchAction searchStore={search} placeholder="Search databases..." />
			<ActionButton icon={Plus} title="Link Database" on:click={() => goto('/databases/new')} />
			<ActionButton icon={Info} title="Info" on:click={() => (showInfoModal = true)} />
			<ViewToggle bind:value={$view} />
		</ActionsBar>

		<!-- Content -->
		<div class="mt-6">
			{#if $filtered.length === 0}
				<div
					class="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900"
				>
					<p class="text-neutral-600 dark:text-neutral-400">No databases match your search</p>
				</div>
			{:else if $view === 'table'}
				<TableView databases={$filtered} on:unlink={handleUnlink} />
			{:else}
				<CardView databases={$filtered} on:unlink={handleUnlink} />
			{/if}
		</div>
	</div>
{/if}

<!-- Unlink Confirmation Modal -->
<Modal
	open={showUnlinkModal}
	header="Unlink Database"
	bodyMessage={`Are you sure you want to unlink "${selectedDatabase?.name}"? This action cannot be undone and all local data will be permanently removed.`}
	confirmText="Unlink"
	cancelText="Cancel"
	confirmDanger={true}
	loading={unlinkLoading}
	on:confirm={() => {
		if (selectedDatabase) {
			unlinkLoading = true;
			unlinkFormElement?.requestSubmit();
		}
	}}
	on:cancel={() => {
		showUnlinkModal = false;
		selectedDatabase = null;
	}}
/>

<!-- Hidden unlink form -->
<form
	bind:this={unlinkFormElement}
	method="POST"
	action="?/delete"
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			unlinkLoading = false;
			showUnlinkModal = false;
			if (result.type === 'failure' && result.data) {
				alertStore.add(
					'error',
					(result.data as { error?: string }).error || 'Failed to unlink database'
				);
			} else if (result.type === 'redirect') {
				alertStore.add('success', 'Database unlinked successfully');
			}
			await update();
			selectedDatabase = null;
		};
	}}
>
	<input type="hidden" name="id" value={selectedDatabase?.id || ''} />
</form>

<!-- Info Modal -->
<InfoModal bind:open={showInfoModal} header="Databases">
	<div class="space-y-4 text-sm text-neutral-600 dark:text-neutral-400">
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">What are Databases?</div>
			<div class="mt-1">
				Databases are Profilarr Compliant Database (PCD) repositories containing quality profiles,
				custom formats, and other configurations. Link a database to import and sync configurations
				to your Arr instances.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Private & Dev Badges</div>
			<div class="mt-1">
				<strong>Private</strong> indicates the repository requires authentication.
				<strong>Dev</strong> means you have a personal access token configured, allowing you to push
				changes back to the repository.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Sync Strategy</div>
			<div class="mt-1">
				Controls how often Profilarr checks for updates from the remote repository. Set to "Manual"
				to only sync when you explicitly trigger it, or choose an interval for automatic updates.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Unlinking</div>
			<div class="mt-1">
				Unlinking a database removes all local data associated with it. Your Arr instances will keep
				any configurations that were already synced, but you won't be able to sync updates until you
				re-link the database.
			</div>
		</div>
	</div>
</InfoModal>
