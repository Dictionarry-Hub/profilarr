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
			'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100/80 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-950/70',
		error:
			'border-red-200 bg-red-50 text-red-900 hover:bg-red-100/80 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-100 dark:hover:bg-red-950/70',
		warning:
			'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100/80 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-950/70',
		info: 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100/80 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-950/70'
	};

	const iconColors = {
		success: 'text-emerald-600 dark:text-emerald-300',
		error: 'text-red-600 dark:text-red-300',
		warning: 'text-amber-600 dark:text-amber-300',
		info: 'text-sky-600 dark:text-sky-300'
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
	class="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-black/5 backdrop-blur-sm transition-colors {styles[
		type
	]}"
>
	<Icon size={18} class="flex-shrink-0 {iconColors[type]}" />
	<p class="text-sm font-medium">{message}</p>
</div>
