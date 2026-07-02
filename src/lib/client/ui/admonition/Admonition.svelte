<script lang="ts">
	import type { ComponentType } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import { X, Info, AlertTriangle, AlertOctagon, CheckCircle2, MessageSquare } from 'lucide-svelte';
	import Button from '$ui/button/Button.svelte';
	import Modal from '$ui/modal/Modal.svelte';

	type Variant = 'info' | 'warning' | 'danger' | 'success' | 'note';

	export let variant: Variant = 'info';
	export let title: string | undefined = undefined;
	export let icon: ComponentType | undefined = undefined;
	export let dismissible: boolean = false;
	export let confirmDismiss: boolean = false;
	export let confirmHeader: string = 'Are you sure?';
	export let confirmMessage: string = 'This message will be permanently hidden.';
	export let confirmText: string = 'Dismiss';
	export let className: string = '';

	const dispatch = createEventDispatcher<{ dismiss: void }>();

	const defaultIcons: Record<Variant, ComponentType> = {
		info: Info,
		warning: AlertTriangle,
		danger: AlertOctagon,
		success: CheckCircle2,
		note: MessageSquare
	};

	const variantStyles: Record<Variant, { accent: string; surface: string; divider: string }> = {
		info: {
			accent: 'text-info-text',
			surface: 'border-info-border bg-info-bg',
			divider: 'border-info-border'
		},
		warning: {
			accent: 'text-warning-text',
			surface: 'border-warning-border bg-warning-bg',
			divider: 'border-warning-border'
		},
		danger: {
			accent: 'text-danger-text',
			surface: 'border-danger-border bg-danger-bg',
			divider: 'border-danger-border'
		},
		success: {
			accent: 'text-success-text',
			surface: 'border-success-border bg-success-bg',
			divider: 'border-success-border'
		},
		note: {
			accent: 'text-text-soft',
			surface: 'border-border bg-surface-muted',
			divider: 'border-border'
		}
	};

	let showConfirm = false;

	function handleClickDismiss() {
		if (confirmDismiss) {
			showConfirm = true;
		} else {
			dispatch('dismiss');
		}
	}

	function handleConfirm() {
		showConfirm = false;
		dispatch('dismiss');
	}

	function handleCancel() {
		showConfirm = false;
	}

	$: style = variantStyles[variant];
	$: IconCmp = icon ?? defaultIcons[variant];
</script>

<div class="overflow-hidden rounded-card border {style.surface} {className}">
	<div class="flex items-center gap-2 border-b px-4 py-2 {style.divider}">
		<div class="shrink-0 {style.accent}">
			<svelte:component this={IconCmp} size={18} />
		</div>
		{#if title}
			<h3 class="flex-1 text-sm font-semibold text-text">{title}</h3>
		{:else}
			<div class="flex-1"></div>
		{/if}
		{#if dismissible}
			<Button
				icon={X}
				variant="ghost"
				size="xs"
				ariaLabel="Dismiss"
				on:click={handleClickDismiss}
			/>
		{/if}
	</div>
	<div class="px-4 py-3 text-sm text-text-soft">
		<slot />
	</div>
</div>

{#if dismissible && confirmDismiss}
	<Modal
		open={showConfirm}
		header={confirmHeader}
		bodyMessage={confirmMessage}
		{confirmText}
		cancelText="Cancel"
		on:confirm={handleConfirm}
		on:cancel={handleCancel}
	/>
{/if}
