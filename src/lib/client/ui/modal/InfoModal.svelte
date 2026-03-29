<script lang="ts">
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { fade, scale } from 'svelte/transition';
	import { X } from 'lucide-svelte';

	export let open = false;
	export let header = 'Information';
	export let size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'md';

	const sizeClasses = {
		sm: 'max-w-sm',
		md: 'max-w-lg',
		lg: 'max-w-2xl',
		xl: 'max-w-4xl',
		'2xl': 'max-w-6xl'
	};

	function handleClose() {
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			handleClose();
		}
	}

	$: if (typeof window !== 'undefined') {
		if (open) {
			window.addEventListener('keydown', handleKeydown);
		} else {
			window.removeEventListener('keydown', handleKeydown);
		}
	}
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
			on:click|self={handleClose}
		>
			<!-- Modal -->
			<div
				class="relative my-4 flex max-h-[calc(100svh-2rem)] w-full {sizeClasses[
					size
				]} flex-col rounded-xl border border-neutral-300 bg-white shadow-xl sm:my-0 dark:border-neutral-700/60 dark:bg-neutral-900"
				in:scale={{ duration: 170, start: 0.97, opacity: 0.5, easing: cubicOut }}
				out:scale={{ duration: 120, start: 0.97, opacity: 0.5, easing: cubicIn }}
			>
				<!-- Header -->
				<div
					class="flex flex-shrink-0 items-center justify-between border-b border-neutral-300 px-6 py-4 dark:border-neutral-700/60"
				>
					<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{header}</h2>
					<button
						type="button"
						on:click={handleClose}
						class="rounded-lg p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
					>
						<X size={20} />
					</button>
				</div>

				<!-- Body -->
				<div class="flex-1 overflow-auto px-6 py-4">
					<slot />
				</div>
			</div>
		</div>
	</div>
{/if}
