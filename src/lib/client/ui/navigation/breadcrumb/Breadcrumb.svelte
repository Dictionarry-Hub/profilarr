<script lang="ts">
	import { ChevronRight } from 'lucide-svelte';

	export let items: { label: string; href: string }[] = [];
	export let current: string = '';
</script>

<div class="flex items-center gap-2 text-sm">
	{#each items as item}
		<a href={item.href} class="text-text-muted transition-colors hover:text-text-soft">
			{item.label}
		</a>
		<ChevronRight size={14} class="text-text-subtle " />
	{/each}
	<span class="font-medium text-text">{current}</span>
</div>
