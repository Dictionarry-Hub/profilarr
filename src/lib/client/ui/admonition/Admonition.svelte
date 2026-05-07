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
			accent: 'text-blue-700 dark:text-blue-300',
			surface: 'border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-950/30',
			divider: 'border-blue-200 dark:border-blue-800/50'
		},
		warning: {
			accent: 'text-amber-700 dark:text-amber-300',
			surface: 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30',
			divider: 'border-amber-200 dark:border-amber-800/50'
		},
		danger: {
			accent: 'text-red-700 dark:text-red-300',
			surface: 'border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30',
			divider: 'border-red-200 dark:border-red-800/50'
		},
		success: {
			accent: 'text-green-700 dark:text-green-300',
			surface: 'border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-950/30',
			divider: 'border-green-200 dark:border-green-800/50'
		},
		note: {
			accent: 'text-neutral-700 dark:text-neutral-300',
			surface: 'border-neutral-300 bg-neutral-50 dark:border-neutral-700/60 dark:bg-neutral-900',
			divider: 'border-neutral-300 dark:border-neutral-700/60'
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

<div class="overflow-hidden rounded-xl border {style.surface} {className}">
	<div class="flex items-center gap-2 border-b px-4 py-2 {style.divider}">
		<div class="shrink-0 {style.accent}">
			<svelte:component this={IconCmp} size={18} />
		</div>
		{#if title}
			<h3 class="flex-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">{title}</h3>
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
	<div class="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
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
