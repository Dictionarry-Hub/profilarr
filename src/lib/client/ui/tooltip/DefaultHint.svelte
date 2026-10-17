<script lang="ts">
	import History from '@lucide/svelte/icons/history';
	import Tooltip from './Tooltip.svelte';

	export let text: string;
	/** A local change that didn't apply. */
	export let pending: boolean = false;
	export let mono: boolean = false;
</script>

<!-- Hover-only, so desktop only: hidden below md. -->
<span class="hidden md:inline-flex">
	<Tooltip {text} position="top" {mono} size="lg">
		<span
			role="img"
			aria-label={text}
			class="inline-flex h-4 w-4 items-center justify-center {pending
				? 'text-amber-500 dark:text-amber-400'
				: 'text-neutral-400 dark:text-neutral-500'}"
		>
			<History size={14} />
		</span>
	</Tooltip>
</span>
