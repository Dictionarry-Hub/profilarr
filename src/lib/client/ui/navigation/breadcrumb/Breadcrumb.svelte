<script lang="ts">
	import { ChevronRight } from 'lucide-svelte';

	export let items: { label: string; href: string }[] = [];
	export let current: string = '';
</script>

<div class="flex items-center gap-2 text-sm">
	{#each items as item}
		<a
			href={item.href}
			class="text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
		>
			{item.label}
		</a>
		<ChevronRight size={14} class="text-neutral-400 dark:text-neutral-600" />
	{/each}
	<span class="font-medium text-neutral-900 dark:text-neutral-50">{current}</span>
</div>
