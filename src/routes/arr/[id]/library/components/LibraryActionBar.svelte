<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Check,
		TableProperties,
		RefreshCw,
		ExternalLink,
		Info,
		ArrowUpDown,
		ArrowUp,
		ArrowDown
	} from 'lucide-svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import SmartFilterBar from '$ui/filter/SmartFilterBar.svelte';
	import type { FilterFieldDef, FilterTag } from '$ui/filter/types';
	import type { SearchStore } from '$stores/search';
	import type { ViewMode } from '$lib/client/stores/dataPage';

	export let fields: FilterFieldDef[] = [];
	export let items: any[] = [];
	export let tags: FilterTag[] = [];
	export let filterStorageKey: string = '';
	export let searchStore: SearchStore;
	export let visibleColumns: Set<string>;
	export let toggleableColumns: readonly string[];
	export let columnLabels: Record<string, string>;
	export let cacheAgeText: string | null = null;
	export let refreshing: boolean = false;

	export let onToggleColumn: (key: string) => void;
	export let onFilterInfo: () => void;
	export let onRefresh: () => void;
	export let onOpen: () => void;
	export let instanceType: string = 'radarr';
	export let viewMode: ViewMode = 'table';
	export let sortKey: string = 'title';
	export let sortDirection: 'asc' | 'desc' = 'asc';
	export let onSort: (key: string, direction: 'asc' | 'desc') => void = () => {};

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
</script>

<ActionsBar>
	{#if isMobile}
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
		<ActionButton icon={ArrowUpDown} hasDropdown={true} dropdownPosition="right">
			<svelte:fragment slot="dropdown" let:dropdownPosition>
				<Dropdown position={dropdownPosition} mobilePosition="middle" minWidth="12rem">
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
		<ActionButton icon={TableProperties} hasDropdown={true} dropdownPosition="right">
			<svelte:fragment slot="dropdown" let:dropdownPosition let:open>
				<Dropdown position={dropdownPosition} mobilePosition="middle" minWidth="14rem">
					<div class="border-b border-neutral-100 px-4 py-3 dark:border-neutral-700">
						<p class="text-xs text-neutral-500 dark:text-neutral-400">
							Toggle visible table columns
						</p>
					</div>
					<div class="py-1">
						{#each toggleableColumns as colKey}
							<button
								type="button"
								on:click={() => onToggleColumn(colKey)}
								class="flex w-full items-center justify-between gap-3 px-4 py-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 {visibleColumns.has(
									colKey
								)
									? 'bg-neutral-50 dark:bg-neutral-700'
									: ''}"
							>
								<span class="text-neutral-700 dark:text-neutral-300">{columnLabels[colKey]}</span>
								<IconCheckbox
									checked={visibleColumns.has(colKey)}
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
	{/if}
	<ViewToggle bind:value={viewMode} />
</ActionsBar>
