<script lang="ts">
	import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-svelte';
	import type { AlertType } from './store';
	import { alertStore } from './store';
	import { fade, fly } from 'svelte/transition';

	export let id: string;
	export let type: AlertType;
	export let message: string;

	const icons = {
		success: CheckCircle,
		error: XCircle,
		warning: AlertTriangle,
		info: Info
	};

	const styles = {
		success:
			'border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]',
		error:
			'border-[var(--theme-danger-border)] bg-[var(--theme-danger-bg)] text-[var(--theme-danger-text)]',
		warning:
			'border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]',
		info: 'border-[var(--theme-info-border)] bg-[var(--theme-info-bg)] text-[var(--theme-info-text)]'
	};

	const iconColors = {
		success: 'text-[var(--theme-success-icon)]',
		error: 'text-[var(--theme-danger-icon)]',
		warning: 'text-[var(--theme-warning-icon)]',
		info: 'text-[var(--theme-info-icon)]'
	};

	const Icon = icons[type];

	function dismiss() {
		alertStore.remove(id);
	}
</script>

<div
	in:fly={{ y: -12, duration: 200 }}
	out:fade={{ duration: 150 }}
	role="button"
	tabindex="0"
	on:click={dismiss}
	on:keydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			dismiss();
		}
	}}
	class="flex cursor-pointer items-center gap-3 rounded-card border px-4 py-3 shadow-card shadow-card-black/5 backdrop-blur-sm transition-colors {styles[
		type
	]}"
>
	<Icon size={18} class="flex-shrink-0 {iconColors[type]}" />
	<p class="text-sm font-medium">{message}</p>
</div>
