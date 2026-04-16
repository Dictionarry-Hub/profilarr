<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		TableProperties,
		RefreshCw,
		ExternalLink,
		Info,
		ArrowUpDown,
		ArrowUp,
		ArrowDown,
		ChevronsDownUp,
		ChevronsUpDown
	} from 'lucide-svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import FilterModeToggle from '$ui/actions/FilterModeToggle.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import SmartFilterBar from '$ui/filter/SmartFilterBar.svelte';
	import type { FilterFieldDef, FilterTag } from '$ui/filter/types';
	import type { SearchStore } from '$stores/search';
	import { filterMode } from '$stores/filterMode';
	import type { ViewMode } from '$lib/client/stores/dataPage';

	export let fields: FilterFieldDef[] = [];
	export let items: any[] = [];
	export let tags: FilterTag[] = [];
	export let filterStorageKey: string = '';
	export let searchStore: SearchStore;
	export let visibleColumns: Set<string>;
	export let toggleableColumns: readonly string[];
	export let columnLabels: Record<string, string>;
	export let visibleCardFields: Set<string> = new Set();
	export let toggleableCardFields: readonly string[] = [];
	export let cardFieldLabels: Record<string, string> = {};
	export let onToggleCardField: (key: string) => void = () => {};
	export let cacheAgeText: string | null = null;
	export let refreshing: boolean = false;

	export let onToggleColumn: (key: string) => void;
	export let onFilterInfo: () => void;
	export let onRefresh: () => void;
	export let onOpen: () => void;
	export let instanceType: string = 'radarr';
	export let viewMode: ViewMode = 'table';
	export let expandAll: boolean = false;
	export let onToggleExpandAll: () => void = () => {};
	export let sortKey: string = 'title';
	export let sortDirection: 'asc' | 'desc' = 'asc';
	export let onSort: (key: string, direction: 'asc' | 'desc') => void = () => {};
	export let useSimpleMode: boolean = false;

	const sortOptions = [
		{ key: 'title', label: 'Title' },
		{ key: 'size', label: 'Size' },
		{ key: 'dateAdded', label: 'Date Added' },
		{ key: 'year', label: 'Year' },
		{ key: 'score', label: 'Score' }
	];

	function handleSortClick(key: string) {
		if (sortKey === key) {
			const newDir = sortDirection === 'asc' ? 'desc' : 'asc';
			onSort(key, newDir);
		} else {
			onSort(key, 'desc');
		}
	}

	$: isRadarr = instanceType === 'radarr';
	$: filterPlaceholder = isRadarr ? 'Filter movies...' : 'Filter series...';
	$: openLabel = isRadarr ? 'Open in Radarr' : 'Open in Sonarr';
	$: refreshTooltip = cacheAgeText ? `Refresh · ${cacheAgeText}` : 'Refresh';

	let isMobile = false;
	let mediaQuery: MediaQueryList | null = null;

	onMount(() => {
		if (typeof window !== 'undefined') {
			mediaQuery = window.matchMedia('(max-width: 767px)');
			isMobile = mediaQuery.matches;
			mediaQuery.addEventListener('change', handleMediaChange);
		}
	});

	onDestroy(() => {
		if (mediaQuery) {
			mediaQuery.removeEventListener('change', handleMediaChange);
		}
	});

	function handleMediaChange(e: MediaQueryListEvent) {
		isMobile = e.matches;
	}

	$: useSimpleMode = isMobile || $filterMode === 'simple';
</script>

<ActionsBar>
	{#if useSimpleMode}
		<SearchAction {searchStore} placeholder={filterPlaceholder} responsive />
	{:else}
		<SmartFilterBar
			{fields}
			{items}
			bind:tags
			storageKey={filterStorageKey}
			placeholder={filterPlaceholder}
		/>
		<Tooltip text="Filter help">
			<ActionButton icon={Info} on:click={onFilterInfo} />
		</Tooltip>
	{/if}
	<Tooltip text={refreshTooltip}>
		<ActionButton
			icon={RefreshCw}
			iconClass={refreshing ? 'animate-spin' : ''}
			on:click={onRefresh}
		/>
	</Tooltip>
	<Tooltip text={openLabel}>
		<ActionButton icon={ExternalLink} on:click={onOpen} />
	</Tooltip>
	{#if viewMode === 'cards'}
		<ActionButton icon={TableProperties} hasDropdown={true} dropdownPosition="right">
			<svelte:fragment slot="dropdown" let:dropdownPosition>
				<Dropdown position={dropdownPosition} minWidth="14rem">
					<DropdownHeader label="Toggle fields" />
					{#each toggleableCardFields as fieldKey}
						<DropdownItem
							label={cardFieldLabels[fieldKey]}
							selected={visibleCardFields.has(fieldKey)}
							on:click={() => onToggleCardField(fieldKey)}
						/>
					{/each}
				</Dropdown>
			</svelte:fragment>
		</ActionButton>
		<ActionButton icon={ArrowUpDown} hasDropdown={true} dropdownPosition="right">
			<svelte:fragment slot="dropdown" let:dropdownPosition>
				<Dropdown position={dropdownPosition} minWidth="12rem">
					<DropdownHeader label="Sort by" />
					{#each sortOptions as option}
						<DropdownItem
							label={option.label}
							selected={sortKey === option.key}
							checkIcon={sortDirection === 'asc' ? ArrowUp : ArrowDown}
							on:click={() => handleSortClick(option.key)}
						/>
					{/each}
				</Dropdown>
			</svelte:fragment>
		</ActionButton>
	{/if}
	{#if viewMode === 'table'}
		<Tooltip text={expandAll ? 'Collapse all rows' : 'Expand all rows'}>
			<ActionButton
				icon={expandAll ? ChevronsDownUp : ChevronsUpDown}
				on:click={onToggleExpandAll}
			/>
		</Tooltip>
		<ActionButton icon={TableProperties} hasDropdown={true} dropdownPosition="right">
			<svelte:fragment slot="dropdown" let:dropdownPosition>
				<Dropdown position={dropdownPosition} minWidth="14rem">
					<DropdownHeader label="Toggle columns" />
					{#each toggleableColumns as colKey}
						<DropdownItem
							label={columnLabels[colKey]}
							selected={visibleColumns.has(colKey)}
							on:click={() => onToggleColumn(colKey)}
						/>
					{/each}
				</Dropdown>
			</svelte:fragment>
		</ActionButton>
	{/if}
	{#if !isMobile}
		<FilterModeToggle bind:value={$filterMode} />
	{/if}
	<ViewToggle bind:value={viewMode} />
</ActionsBar>
