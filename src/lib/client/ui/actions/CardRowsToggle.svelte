<script lang="ts">
	import ActionButton from './ActionButton.svelte';
	import Dropdown from '#ui/dropdown/Dropdown.svelte';
	import DropdownHeader from '#ui/dropdown/DropdownHeader.svelte';
	import DropdownItem from '#ui/dropdown/DropdownItem.svelte';
	import Rows3 from '@lucide/svelte/icons/rows-3';
	import type { CardRowOption, CardRowsStore } from '#stores/dataPage.ts';

	/** Every row the cards can show, in card order. */
	export let rows: readonly CardRowOption[];
	/** Visible row keys; toggling saves the choice in this browser. */
	export let store: CardRowsStore;
	export let position: 'left' | 'right' | 'middle' = 'right';
</script>

<ActionButton icon={Rows3} hasDropdown={true} dropdownPosition={position} ariaLabel="Card rows">
	<Dropdown slot="dropdown" {position} minWidth="17rem">
		<DropdownHeader
			label="Card Rows"
			description="Choose which rows each card shows. Saved in this browser."
		/>
		{#each rows as row}
			<DropdownItem
				icon={row.icon}
				label={row.label}
				description={row.description ?? ''}
				selected={$store.includes(row.key)}
				on:click={() => store.toggle(row.key)}
			/>
		{/each}
	</Dropdown>
</ActionButton>
