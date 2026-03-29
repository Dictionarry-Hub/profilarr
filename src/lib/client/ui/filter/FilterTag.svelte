<script lang="ts">
	import { X } from 'lucide-svelte';
	import Label from '$ui/label/Label.svelte';
	import type { FilterTag } from './types';

	export let tag: FilterTag;
	export let fieldLabel: string;
	export let onremove: () => void;
	export let ontogglenegated: () => void;
</script>

<span class="inline-flex items-center gap-1">
	<button type="button" on:click={ontogglenegated} class="cursor-pointer">
		<Label variant={tag.negated ? 'danger' : 'info'} size="md" rounded="md">
			<span class="opacity-60">{fieldLabel}:</span>
			<span class={tag.negated ? 'line-through' : ''}>{tag.value}</span>
		</Label>
	</button>
	<button
		type="button"
		on:click={onremove}
		class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
		aria-label="Remove filter"
	>
		<X size={14} />
	</button>
</span>
