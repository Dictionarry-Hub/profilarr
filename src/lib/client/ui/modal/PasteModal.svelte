<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Modal from './Modal.svelte';
	import FormInput from '$ui/form/FormInput.svelte';

	export let open = false;
	export let header = 'Paste';
	export let label = 'Paste content';
	export let description = '';
	export let placeholder = '';
	export let confirmText = 'Paste';
	export let cancelText = 'Cancel';
	export let rows = 10;

	const dispatch = createEventDispatcher<{ confirm: string; cancel: void }>();

	let content = '';
	let wasOpen = false;
	let inputElement: HTMLInputElement | HTMLTextAreaElement | null = null;

	$: confirmDisabled = content.trim() === '';
	$: {
		if (open && !wasOpen) {
			content = '';
			void focusInput();
		}
		wasOpen = open;
	}

	async function focusInput() {
		await tick();
		inputElement?.focus();
	}

	function handleConfirm() {
		if (confirmDisabled) return;
		dispatch('confirm', content);
	}

	function handleCancel() {
		dispatch('cancel');
	}
</script>

<Modal
	{open}
	{header}
	{confirmText}
	{cancelText}
	{confirmDisabled}
	size="lg"
	on:confirm={handleConfirm}
	on:cancel={handleCancel}
>
	<div slot="body">
		<FormInput
			{label}
			{description}
			{placeholder}
			{rows}
			textarea
			mono
			name="paste-modal-content"
			bind:value={content}
			bind:inputElement
		/>
	</div>
</Modal>
