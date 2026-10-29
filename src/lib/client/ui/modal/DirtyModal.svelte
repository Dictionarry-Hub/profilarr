<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import Modal from './Modal.svelte';
	import {
		isDirty,
		showModal,
		confirmNavigation,
		confirmDiscard,
		cancelDiscard
	} from '#stores/dirty.ts';

	let pendingNavigationUrl: string | null = null;

	beforeNavigate(async (navigation) => {
		if (navigation.shallow && navigation.type === 'goto') return;

		if ($isDirty) {
			navigation.cancel();
			pendingNavigationUrl = navigation.to?.url.pathname || null;
			const shouldNavigate = await confirmNavigation();
			if (shouldNavigate && pendingNavigationUrl) {
				goto(pendingNavigationUrl);
			}
			pendingNavigationUrl = null;
		}
	});
</script>

<Modal
	open={$showModal}
	header="Unsaved Changes"
	bodyMessage="You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost."
	confirmText="Discard Changes"
	cancelText="Stay on Page"
	confirmDanger={true}
	on:confirm={() => confirmDiscard()}
	on:cancel={() => cancelDiscard()}
/>
