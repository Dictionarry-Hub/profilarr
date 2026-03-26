<script lang="ts">
	import { Check, TableProperties, LayoutGrid, RefreshCw, ExternalLink, Info } from 'lucide-svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import SmartFilterBar from '$ui/filter/SmartFilterBar.svelte';
	import type { FilterFieldDef, FilterTag } from '$ui/filter/types';
	import type { ViewMode } from '$lib/client/stores/dataPage';

	export let fields: FilterFieldDef[] = [];
	export let items: any[] = [];
	export let tags: FilterTag[] = [];
	export let filterStorageKey: string = '';
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
	export let cardsPerRow: number = 10;

	const CARDS_PER_ROW_OPTIONS = [4, 6, 8, 10, 12, 14, 16];

	$: isRadarr = instanceType === 'radarr';
	$: filterPlaceholder = isRadarr ? 'Filter movies...' : 'Filter series...';
	$: openLabel = isRadarr ? 'Open in Radarr' : 'Open in Sonarr';
	$: refreshTooltip = cacheAgeText ? `Refresh · ${cacheAgeText}` : 'Refresh';
</script>

<ActionsBar>
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
		<ActionButton icon={LayoutGrid} hasDropdown={true} dropdownPosition="right">
			<Dropdown slot="dropdown" position="right">
				<DropdownHeader label="Cards per row" />
				{#each CARDS_PER_ROW_OPTIONS as count}
					<DropdownItem
						label={String(count)}
						selected={cardsPerRow === count}
						on:click={() => (cardsPerRow = count)}
					/>
				{/each}
			</Dropdown>
		</ActionButton>
	{:else}
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
