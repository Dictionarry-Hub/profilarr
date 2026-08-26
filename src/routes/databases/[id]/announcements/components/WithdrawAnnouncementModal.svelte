<script lang="ts">
	import { resolve } from '$app/paths';
	import { createEventDispatcher } from 'svelte';
	import { enhance } from '$app/forms';
	import Modal from '$ui/modal/Modal.svelte';
	import { alertStore } from '$alerts/store';

	export let open = false;
	export let databaseId: string | number;
	export let announcementId: string | null;
	// Bindable in-flight flag for parents that need to disable other
	// buttons while the withdraw is submitting (e.g. the Save button on
	// the edit form).
	export let withdrawing = false;

	// `withdrawn` fires *before* the post-submit navigation. Consumers that
	// share a dirty store with the announcement form (e.g. AnnouncementForm
	// in edit mode) can use this hook to snapshot the dirty state in time
	// for the redirect's beforeNavigate.
	const dispatch = createEventDispatcher<{ cancel: void; withdrawn: void }>();

	let formEl: HTMLFormElement | null = null;

	function handleConfirm() {
		formEl?.requestSubmit();
	}
</script>

{#if open && announcementId}
	<form
		bind:this={formEl}
		method="POST"
		action={resolve(`/databases/${databaseId}/announcements/${announcementId}?/delete`)}
		class="hidden"
		use:enhance={() => {
			withdrawing = true;
			return async ({ result, update }) => {
				if (result.type === 'redirect') {
					dispatch('withdrawn');
					alertStore.add('success', 'Announcement withdrawn');
				} else if (result.type === 'failure') {
					const data = result.data as { error?: string };
					alertStore.add('error', data?.error ?? 'Failed to withdraw');
				}
				await update();
				withdrawing = false;
			};
		}}
	></form>
{/if}

<Modal
	{open}
	header="Withdraw announcement"
	bodyMessage="Withdrawing deletes the announcement file from the working copy. Linked databases will mark this announcement as withdrawn on their next sync. This cannot be undone unless you re-create the file."
	confirmText="Withdraw"
	cancelText="Cancel"
	confirmDanger={true}
	confirmDisabled={withdrawing}
	loading={withdrawing}
	on:cancel
	on:confirm={handleConfirm}
/>
