<script lang="ts">
	import ActionButton from './ActionButton.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import { Filter, Search, SlidersHorizontal } from 'lucide-svelte';
	import type { FilterMode } from '$stores/filterMode';

	export let value: FilterMode = 'smart';
	export let position: 'left' | 'right' | 'middle' = 'right';
</script>

<ActionButton icon={SlidersHorizontal} hasDropdown={true} dropdownPosition={position}>
	<Dropdown slot="dropdown" {position}>
		<DropdownHeader label="Bar mode" />
		<DropdownItem
			icon={Filter}
			label="Filter"
			selected={value === 'smart'}
			on:click={() => (value = 'smart')}
		/>
		<DropdownItem
			icon={Search}
			label="Search"
			selected={value === 'simple'}
			on:click={() => (value = 'simple')}
		/>
	</Dropdown>
</ActionButton>
