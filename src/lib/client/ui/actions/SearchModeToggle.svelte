<script lang="ts">
	import { Check } from 'lucide-svelte';
	import type { ComponentType } from 'svelte';
	import ActionButton from './ActionButton.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';

	export let options: { value: string; label: string }[] = [];
	export let value: string = '';
	export let icon: ComponentType;
	export let onchange: (value: string) => void = () => {};
</script>

<ActionButton {icon} hasDropdown={true} dropdownPosition="left">
	<svelte:fragment slot="dropdown" let:dropdownPosition>
		<Dropdown position={dropdownPosition} mobilePosition="middle" minWidth="12rem">
			<div class="py-1">
				{#each options as option}
					<button
						type="button"
						on:click={() => onchange(option.value)}
						class="flex w-full items-center justify-between gap-3 px-4 py-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 {value ===
						option.value
							? 'bg-neutral-50 dark:bg-neutral-700'
							: ''}"
					>
						<span class="text-neutral-700 dark:text-neutral-300">{option.label}</span>
						<IconCheckbox
							checked={value === option.value}
							icon={Check}
							color="blue"
							shape="circle"
						/>
					</button>
				{/each}
			</div>
		</Dropdown>
	</svelte:fragment>
</ActionButton>
