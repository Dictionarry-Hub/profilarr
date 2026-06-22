<script lang="ts">
	import { X, Plus } from 'lucide-svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import Button from '$ui/button/Button.svelte';
	import { Check } from 'lucide-svelte';

	export let customGroups: Array<{ name: string; key: string; tags: string[]; custom: boolean }> =
		[];
	export let selectedGroups: Set<string>;
	export let onAdd: (name: string, tags: string[]) => void;
	export let onDelete: (key: string) => void;
	export let onToggle: (key: string) => void;

	let newGroupName = '';
	let newGroupTags = '';

	function handleSubmit() {
		if (newGroupName && newGroupTags) {
			const tags = newGroupTags
				.split(',')
				.map((t) => t.trim())
				.filter((t) => t.length > 0);
			if (tags.length > 0) {
				onAdd(newGroupName, tags);
				newGroupName = '';
				newGroupTags = '';
			}
		}
	}
</script>

<!-- Add new group form -->
<div class="border-t border-neutral-200 px-4 py-3 dark:border-neutral-700">
	<div class="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
		Add Custom Group
	</div>
	<form on:submit|preventDefault={handleSubmit} class="space-y-2">
		<FormInput
			label="Group name"
			name="groupName"
			placeholder="Group name"
			bind:value={newGroupName}
			hideLabel
			size="sm"
		/>
		<FormInput
			label="Tags"
			name="groupTags"
			placeholder="Tags (comma-separated)"
			bind:value={newGroupTags}
			hideLabel
			size="sm"
		/>
		<Button
			type="submit"
			text="Add Group"
			icon={Plus}
			variant="primary"
			size="xs"
			fullWidth
			disabled={!newGroupName || !newGroupTags}
		/>
	</form>
</div>

<!-- Custom groups list -->
{#if customGroups.length > 0}
	<div class="border-t border-neutral-200 dark:border-neutral-700">
		{#each customGroups as group}
			<div
				class="group flex items-center justify-between gap-2 px-4 py-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
			>
				<button
					type="button"
					on:click={() => onToggle(group.key)}
					class="flex flex-1 items-center justify-between gap-3"
				>
					<div class="flex-1 text-left">
						<div class="text-xs font-medium text-neutral-700 dark:text-neutral-300">
							{group.name}
						</div>
						<div class="text-xs text-neutral-500 dark:text-neutral-400">
							{group.tags.join(', ')}
						</div>
					</div>
					<IconCheckbox
						checked={selectedGroups.has(group.key)}
						icon={Check}
						color="blue"
						shape="circle"
					/>
				</button>
				<button
					type="button"
					on:click|stopPropagation={() => onDelete(group.key)}
					class="flex h-5 w-5 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
				>
					<X size={12} />
				</button>
			</div>
		{/each}
	</div>
{/if}
