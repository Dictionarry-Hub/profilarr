<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Check } from 'lucide-svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import IconCheckbox from '$lib/client/ui/form/IconCheckbox.svelte';
	import FormInput from '$lib/client/ui/form/FormInput.svelte';

	type GroupModalItem = {
		name: string;
		enabled: boolean;
		upgradeUntil: boolean;
	};

	export let open = false;
	export let title = 'Create Group';
	export let confirmText = 'Create Group';
	export let confirmDisabled = false;
	export let description =
		'Select at least two qualities to combine into a group. Groups share the same priority.';
	export let groupName = '';
	export let items: GroupModalItem[] = [];
	export let selectedNames: Set<string> = new Set();
	export let size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'lg';
	export let height: 'auto' | 'md' | 'lg' | 'xl' | 'full' = 'xl';

	const dispatch = createEventDispatcher<{
		confirm: void;
		cancel: void;
		toggle: { name: string };
	}>();

	function handleToggle(name: string) {
		dispatch('toggle', { name });
	}
</script>

<Modal
	{open}
	header={title}
	{confirmText}
	cancelText="Cancel"
	{confirmDisabled}
	{size}
	{height}
	on:confirm={() => dispatch('confirm')}
	on:cancel={() => dispatch('cancel')}
>
	<div slot="body" class="flex h-full flex-col gap-4">
		<p class="text-sm text-neutral-600 dark:text-neutral-400">
			{description}
		</p>

		<FormInput
			label="Group Name"
			name="quality-group-name"
			placeholder="e.g. Web + Bluray"
			required
			value={groupName}
			on:input={(event) => {
				groupName = event.detail;
			}}
		/>

		<div class="min-h-0 flex-1 space-y-2 overflow-auto">
			{#if items.length < 2}
				<div class="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
					At least two qualities are required for a group.
				</div>
			{:else}
				{#each items as item}
					<button
						type="button"
						on:click={() => handleToggle(item.name)}
						class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-left transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:hover:bg-neutral-700"
					>
						<div class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
							{item.name}
						</div>
						<IconCheckbox
							checked={selectedNames.has(item.name)}
							icon={Check}
							color="blue"
							shape="circle"
						/>
					</button>
				{/each}
			{/if}
		</div>
	</div>
</Modal>
