<script lang="ts">
	import {
		Check,
		SlidersHorizontal,
		TableProperties,
		RefreshCw,
		ExternalLink,
		Type,
		Palette
	} from 'lucide-svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import TagInput from '$ui/form/TagInput.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import { type SearchStore } from '$stores/search';

	type FilterOperator = 'eq' | 'neq';
	type FilterField = 'qualityName' | 'qualityProfileName';

	interface ActiveFilter {
		field: FilterField;
		operator: FilterOperator;
		value: string | number | boolean;
		label: string;
	}

	export let searchStore: SearchStore;
	export let visibleColumns: Set<string>;
	export let toggleableColumns: readonly string[];
	export let columnLabels: Record<string, string>;
	export let activeFilters: ActiveFilter[];
	export let uniqueQualities: string[];
	export let uniqueProfiles: string[];
	export let cacheAgeText: string | null = null;
	export let refreshing: boolean = false;

	export let onToggleColumn: (key: string) => void;
	export let onToggleFilter: (
		field: FilterField,
		operator: FilterOperator,
		value: string | number | boolean,
		label: string
	) => void;
	export let onRefresh: () => void;
	export let onOpen: () => void;
	export let instanceType: string = 'radarr';

	// Search mode (Radarr only)
	export let searchMode: 'title' | 'customFormats' = 'title';
	export let onSearchModeChange: (mode: 'title' | 'customFormats') => void = () => {};
	export let cfTags: string[] = [];
	export let onCfTagsChange: (tags: string[]) => void = () => {};

	$: isRadarr = instanceType === 'radarr';
	$: searchPlaceholder = isRadarr ? 'Search movies...' : 'Search series...';
	$: openLabel = isRadarr ? 'Open in Radarr' : 'Open in Sonarr';
	$: refreshTooltip = cacheAgeText ? `Refresh: Last updated ${cacheAgeText}` : 'Refresh library';
	$: filterDescription = isRadarr
		? 'Filter movies by quality or profile'
		: 'Filter series by profile';

	const searchModes = [
		{ value: 'title' as const, label: 'Title' },
		{ value: 'customFormats' as const, label: 'Custom Formats' }
	];

	$: searchModeIcon = searchMode === 'title' ? Type : Palette;
</script>

<ActionsBar>
	{#if isRadarr}
		<ActionButton icon={searchModeIcon} hasDropdown={true} dropdownPosition="left">
			<svelte:fragment slot="dropdown" let:dropdownPosition>
				<Dropdown position={dropdownPosition} mobilePosition="middle" minWidth="12rem">
					<div class="py-1">
						{#each searchModes as mode}
							<button
								type="button"
								on:click={() => onSearchModeChange(mode.value)}
								class="flex w-full items-center justify-between gap-3 px-4 py-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 {searchMode ===
								mode.value
									? 'bg-neutral-50 dark:bg-neutral-700'
									: ''}"
							>
								<span class="text-neutral-700 dark:text-neutral-300">{mode.label}</span>
								<IconCheckbox
									checked={searchMode === mode.value}
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
	{#if searchMode === 'title' || !isRadarr}
		<SearchAction {searchStore} placeholder={searchPlaceholder} responsive />
	{:else}
		<div class="flex-1">
			<TagInput
				tags={cfTags}
				placeholder="Type a custom format name and press Enter..."
				onchange={onCfTagsChange}
			/>
		</div>
	{/if}
	<ActionButton icon={SlidersHorizontal} hasDropdown={true} dropdownPosition="right">
		<svelte:fragment slot="dropdown" let:dropdownPosition let:open>
			<Dropdown position={dropdownPosition} mobilePosition="middle" minWidth="16rem">
				<div class="border-b border-neutral-100 px-4 py-3 dark:border-neutral-700">
					<p class="text-xs text-neutral-500 dark:text-neutral-400">
						{filterDescription}
					</p>
				</div>
				<div class="max-h-96 overflow-y-auto">
					<!-- Quality Filter (Radarr only) -->
					{#if isRadarr && uniqueQualities.length > 0}
						<div class="border-b border-neutral-100 dark:border-neutral-700">
							<div class="bg-neutral-50 px-3 py-2 dark:bg-neutral-800">
								<span
									class="text-xs font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400"
									>Quality</span
								>
							</div>
							{#each uniqueQualities as quality}
								<button
									type="button"
									on:click={() => onToggleFilter('qualityName', 'eq', quality, quality)}
									class="flex w-full items-center justify-between gap-3 px-4 py-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 {activeFilters.find(
										(f) => f.field === 'qualityName' && f.value === quality
									)
										? 'bg-neutral-50 dark:bg-neutral-700'
										: ''}"
								>
									<span class="text-neutral-700 dark:text-neutral-300">{quality}</span>
									<IconCheckbox
										checked={!!activeFilters.find(
											(f) => f.field === 'qualityName' && f.value === quality
										)}
										icon={Check}
										color="blue"
										shape="circle"
									/>
								</button>
							{/each}
						</div>
					{/if}

					<!-- Profile Filter -->
					<div>
						<div class="bg-neutral-50 px-3 py-2 dark:bg-neutral-800">
							<span
								class="text-xs font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400"
								>Profile</span
							>
						</div>
						{#each uniqueProfiles as profile}
							<button
								type="button"
								on:click={() => onToggleFilter('qualityProfileName', 'eq', profile, profile)}
								class="flex w-full items-center justify-between gap-3 px-4 py-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 {activeFilters.find(
									(f) => f.field === 'qualityProfileName' && f.value === profile
								)
									? 'bg-neutral-50 dark:bg-neutral-700'
									: ''}"
							>
								<span class="text-neutral-700 dark:text-neutral-300">{profile}</span>
								<IconCheckbox
									checked={!!activeFilters.find(
										(f) => f.field === 'qualityProfileName' && f.value === profile
									)}
									icon={Check}
									color="blue"
									shape="circle"
								/>
							</button>
						{/each}
					</div>
				</div>
			</Dropdown>
		</svelte:fragment>
	</ActionButton>
	<ActionButton icon={TableProperties} hasDropdown={true} dropdownPosition="right">
		<svelte:fragment slot="dropdown" let:dropdownPosition let:open>
			<Dropdown position={dropdownPosition} mobilePosition="middle" minWidth="14rem">
				<div class="border-b border-neutral-100 px-4 py-3 dark:border-neutral-700">
					<p class="text-xs text-neutral-500 dark:text-neutral-400">Toggle visible table columns</p>
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
</ActionsBar>
