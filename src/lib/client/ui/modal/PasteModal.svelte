<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Modal from './Modal.svelte';
	import CodeInput from '$ui/form/CodeInput.svelte';

	export let open = false;
	export let header = 'Paste';
	export let label = 'Paste content';
	export let description = '';
	export let placeholder = '';
	export let confirmText = 'Paste';
	export let cancelText = 'Cancel';
	export let rows = 10;
	export let language = 'json';

	const dispatch = createEventDispatcher<{ confirm: string; cancel: void }>();

	let content = '';
	let wasOpen = false;
	let inputElement: HTMLTextAreaElement | null = null;

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
		<CodeInput
			{label}
			{description}
			{placeholder}
			{rows}
			{language}
			name="paste-modal-content"
			bind:value={content}
			bind:inputElement
		/>
	</div>
</Modal>
