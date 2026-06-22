<script lang="ts">
	import { X } from 'lucide-svelte';
	import Label from '$ui/label/Label.svelte';
	import { alertStore } from '$lib/client/alerts/store';

	export let tags: string[] = [];
	export let placeholder = 'Type and press Enter to add tags';
	export let onchange: ((tags: string[]) => void) | undefined = undefined;

	let inputValue = '';
	let lastDuplicateTag: string | null = null;
	let lastDuplicateAt = 0;

	function isNegated(tag: string): boolean {
		return tag.toUpperCase().startsWith('NOT:');
	}

	function displayName(tag: string): string {
		if (isNegated(tag)) return tag.slice(4).trim();
		return tag;
	}

	function updateTags(newTags: string[]) {
		tags = newTags;
		onchange?.(newTags);
	}

	function addTag() {
		const trimmed = inputValue.trim();
		if (!trimmed) return;
		const normalized = trimmed.toLowerCase();
		const existingNormalized = tags.map((tag) => tag.toLowerCase());
		if (existingNormalized.includes(normalized)) {
			const now = Date.now();
			if (lastDuplicateTag !== normalized || now - lastDuplicateAt > 1500) {
				alertStore.add('error', 'Tag already added.', 2000);
				lastDuplicateTag = normalized;
				lastDuplicateAt = now;
			}
			return;
		}

		updateTags([...tags, trimmed]);
		inputValue = '';
	}

	function removeTag(index: number) {
		updateTags(tags.filter((_, i) => i !== index));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addTag();
		} else if (event.key === 'Backspace' && inputValue === '' && tags.length > 0) {
			// Remove last tag when backspace is pressed on empty input
			removeTag(tags.length - 1);
		}
	}
</script>

<div
	class="flex min-h-[2.5rem] flex-wrap items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 transition-colors dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-50"
>
	{#each tags as tag, index (tag)}
		<span class="inline-flex items-center gap-1">
			<Label variant={isNegated(tag) ? 'danger' : 'info'} size="md" rounded="md"
				>{displayName(tag)}</Label
			>
			<button
				type="button"
				on:click={() => removeTag(index)}
				class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
				aria-label="Remove tag"
			>
				<X size={14} />
			</button>
		</span>
	{/each}

	<input
		type="text"
		id="tags-input"
		bind:value={inputValue}
		on:keydown={handleKeydown}
		{placeholder}
		class="min-w-[120px] flex-1 border-0 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-0 dark:text-neutral-50 dark:placeholder:text-neutral-500"
	/>
</div>
