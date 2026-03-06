<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { fade, scale } from 'svelte/transition';
	import { X, Check, Loader2 } from 'lucide-svelte';
	import Button from '$ui/button/Button.svelte';

	// Props
	export let open = false;
	export let header = 'Confirm';
	export let bodyMessage = 'Are you sure?';
	export let confirmText = 'Confirm';
	export let cancelText = 'Cancel';
	export let confirmDanger = false; // If true, confirm button is styled as danger (red)
	export let confirmDisabled = false;
	export let loading = false; // Shows spinner and disables buttons
	export let size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'md';
	export let height: 'auto' | 'md' | 'lg' | 'xl' | 'full' = 'auto';
	export let bodyOverflow: 'auto' | 'visible' = 'auto';

	const sizeClasses = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-2xl',
		xl: 'max-w-4xl',
		'2xl': 'max-w-6xl'
	};

	const heightClasses = {
		auto: '',
		md: 'h-[50vh]',
		lg: 'h-[70vh]',
		xl: 'h-[85vh]',
		full: 'h-[95vh]'
	};

	const dispatch = createEventDispatcher();

	function handleConfirm() {
		dispatch('confirm');
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			handleCancel();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<div
		class="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-6"
		in:fade={{ duration: 140 }}
		out:fade={{ duration: 110 }}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="flex min-h-full w-full items-start justify-center sm:items-center"
			on:click|self={handleCancel}
		>
			<!-- Modal -->
			<div
				class="relative my-4 flex w-full flex-col {sizeClasses[size]} {heightClasses[
					height
				]} max-h-[calc(100svh-2rem)] rounded-xl border border-neutral-300 bg-white shadow-xl sm:my-0 dark:border-neutral-700/60 dark:bg-neutral-900"
				in:scale={{ duration: 170, start: 0.97, opacity: 0.5, easing: cubicOut }}
				out:scale={{ duration: 120, start: 0.97, opacity: 0.5, easing: cubicIn }}
			>
				<!-- Header -->
				<div class="flex-shrink-0 border-b border-neutral-300 px-6 py-4 dark:border-neutral-700/60">
					<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{header}</h2>
				</div>

				<!-- Body -->
				<div
					class="flex-1 px-6 py-4 {bodyOverflow === 'visible'
						? 'overflow-visible'
						: 'overflow-auto'}"
				>
					<slot name="body">
						<p class="text-sm text-neutral-600 dark:text-neutral-400">{bodyMessage}</p>
					</slot>
				</div>

				<!-- Footer -->
				<div
					class="flex flex-shrink-0 justify-between border-t border-neutral-300 px-6 py-4 dark:border-neutral-700/60"
				>
					<slot name="footer">
						<Button text={cancelText} icon={X} disabled={loading} on:click={handleCancel} />
						<Button
							text={confirmText}
							icon={loading ? Loader2 : Check}
							variant={confirmDanger ? 'danger' : 'primary'}
							disabled={confirmDisabled || loading}
							{loading}
							on:click={handleConfirm}
						/>
					</slot>
				</div>
			</div>
		</div>
	</div>
{/if}
