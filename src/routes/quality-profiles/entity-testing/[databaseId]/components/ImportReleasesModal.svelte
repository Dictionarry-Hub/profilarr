<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { Film, Tv, Loader2, Server, CircuitBoard, ArrowDownAZ, ArrowUpAZ } from 'lucide-svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import Card from '$ui/card/Card.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import Button from '$ui/button/Button.svelte';
	import SelectableContainer from '$ui/toggle/SelectableContainer.svelte';
	import SelectableRow from '$ui/toggle/SelectableRow.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import { getPersistentSearchStore, type SearchStore } from '$stores/search';
	import { alertStore } from '$alerts/store';
	import type { TestEntity } from '$shared/pcd/display.ts';
	import { page } from '$app/stores';

	export let open = false;
	export let entity: TestEntity | null = null;
	export let arrInstances: Array<{ id: number; name: string; type: 'radarr' | 'sonarr' }> = [];
	export let canWriteToBase: boolean = false;

	let saving = false;
	let formRef: HTMLFormElement;

	// Layer selection
	let selectedLayer: 'user' | 'base' = canWriteToBase ? 'base' : 'user';

	// Step management: 1 = select library item, 2 = select releases
	let step: 1 | 2 = 1;

	// Instance selection
	let selectedInstanceId: number | null = null;

	// Library items
	type LibraryItem = {
		id: number;
		title: string;
		year?: number;
		tmdbId?: number;
		tvdbId?: number;
		seasons?: number[]; // Available seasons for TV series
	};
	let libraryItems: LibraryItem[] = [];
	let loadingLibrary = false;

	// Search store for library filtering
	let searchStore: SearchStore;
	$: searchStore = getPersistentSearchStore(
		`entityTestingImportLibrarySearch:${$page.params.databaseId}`
	);

	// Selected item from library
	let selectedItem: LibraryItem | null = null;

	// Releases from search
	type GroupedRelease = {
		title: string;
		size: number;
		indexers: string[];
		languages: string[];
		flags: string[];
		occurrences: number;
	};
	let releases: GroupedRelease[] = [];
	let loadingReleases = false;
	let selectedReleases: Set<string> = new Set(); // Track by title

	// Search store for release filtering
	let releaseSearchStore: SearchStore;
	$: releaseSearchStore = getPersistentSearchStore(
		`entityTestingImportReleaseSearch:${$page.params.databaseId}`
	);

	// Season selection for TV series (null = not selected yet)
	let selectedSeason: number | null = null;

	// Sort state for releases
	type SortField = 'title' | 'size' | 'indexers';
	type SortDirection = 'asc' | 'desc';
	let sortField: SortField = 'size';
	let sortDirection: SortDirection = 'desc';

	function setSortField(field: SortField) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = field === 'title' ? 'asc' : 'desc';
		}
	}

	async function changeSeason(season: number) {
		selectedSeason = season;
		await loadReleases();
	}

	// Filter instances by entity type
	$: filteredInstances = arrInstances.filter((i) =>
		entity?.type === 'movie' ? i.type === 'radarr' : i.type === 'sonarr'
	);

	// Get selected instance name
	$: selectedInstance = filteredInstances.find((i) => i.id === selectedInstanceId);

	// Auto-select first matching instance
	$: if (open && entity && filteredInstances.length > 0 && selectedInstanceId === null) {
		selectedInstanceId = filteredInstances[0].id;
	}

	// Load library when instance is selected
	$: if (selectedInstanceId && step === 1) {
		loadLibrary();
	}

	async function loadLibrary() {
		if (!selectedInstanceId) return;

		loadingLibrary = true;
		libraryItems = [];
		selectedItem = null;

		try {
			const response = await fetch(`/api/v1/arr/library?instanceId=${selectedInstanceId}`);
			const data = await response.json();

			if (data.error) {
				alertStore.add('error', data.error);
			} else {
				libraryItems = (data.items || []).map((item: any) => ({
					id: item.id,
					title: item.title,
					year: item.year,
					tmdbId: item.tmdbId,
					tvdbId: item.tvdbId,
					seasons: item.seasons?.map((s: any) => (typeof s === 'number' ? s : s.seasonNumber))
				}));
			}
		} catch (err) {
			alertStore.add('error', 'Failed to load library');
		} finally {
			loadingLibrary = false;
		}
	}

	async function loadReleases() {
		if (!selectedInstanceId || !selectedItem) return;

		loadingReleases = true;
		releases = [];
		selectedReleases = new Set<string>();

		try {
			const params = new URLSearchParams({
				instanceId: String(selectedInstanceId),
				itemId: String(selectedItem.id)
			});
			// Add season for TV series
			if (entity?.type === 'series' && selectedSeason !== null) {
				params.set('season', String(selectedSeason));
			}
			const response = await fetch(`/api/v1/arr/releases?${params}`);
			const data = await response.json();

			if (data.error) {
				alertStore.add('error', data.error);
			} else {
				releases = data.releases || [];
			}
		} catch (err) {
			alertStore.add('error', 'Failed to fetch releases');
		} finally {
			loadingReleases = false;
		}
	}

	function selectInstance(id: number) {
		selectedInstanceId = id;
	}

	function toggleRelease(title: string) {
		if (selectedReleases.has(title)) {
			selectedReleases.delete(title);
		} else {
			selectedReleases.add(title);
		}
		selectedReleases = selectedReleases;
	}

	function selectAllReleases() {
		const allSelected = filteredReleases.every((r) => selectedReleases.has(r.title));
		if (allSelected) {
			// Deselect all filtered
			filteredReleases.forEach((r) => selectedReleases.delete(r.title));
		} else {
			// Select all filtered
			filteredReleases.forEach((r) => selectedReleases.add(r.title));
		}
		selectedReleases = selectedReleases;
	}

	$: allFilteredSelected =
		filteredReleases.length > 0 && filteredReleases.every((r) => selectedReleases.has(r.title));

	// Find potential matches based on tmdbId or title
	$: potentialMatches = entity
		? libraryItems.filter((item) => {
				// For Radarr (movies), check tmdbId first
				if (entity.type === 'movie' && entity.tmdb_id && item.tmdbId) {
					return item.tmdbId === entity.tmdb_id;
				}
				// Fall back to title matching
				return item.title.toLowerCase() === entity.title.toLowerCase();
			})
		: [];

	// Get IDs of matches for filtering
	$: matchIds = new Set(potentialMatches.map((m) => m.id));

	// Filter and sort library items (excluding matches)
	$: filteredLibrary = (
		$searchStore.query
			? libraryItems.filter(
					(item) =>
						!matchIds.has(item.id) &&
						item.title.toLowerCase().includes($searchStore.query.toLowerCase())
				)
			: libraryItems.filter((item) => !matchIds.has(item.id))
	).sort((a, b) => a.title.localeCompare(b.title));

	// Filter and sort releases
	$: filteredReleases = (() => {
		let result = $releaseSearchStore.query
			? releases.filter((r) =>
					r.title.toLowerCase().includes($releaseSearchStore.query.toLowerCase())
				)
			: [...releases];

		// Sort
		result.sort((a, b) => {
			let cmp = 0;
			if (sortField === 'title') {
				cmp = a.title.localeCompare(b.title);
			} else if (sortField === 'size') {
				cmp = a.size - b.size;
			} else if (sortField === 'indexers') {
				cmp = a.indexers.length - b.indexers.length;
			}
			return sortDirection === 'asc' ? cmp : -cmp;
		});

		return result;
	})();

	function formatSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	async function handleConfirm() {
		if (step === 1) {
			if (!selectedItem) return;
			step = 2;
			// For movies, load releases immediately
			// For series, wait for user to select a season
			if (entity?.type === 'movie') {
				await loadReleases();
			}
		} else {
			// Step 2: Import selected releases
			if (selectedReleases.size === 0) return;
			selectedLayer = canWriteToBase ? 'base' : 'user';
			await tick();
			formRef?.requestSubmit();
		}
	}

	function handleBack() {
		step = 1;
		releases = [];
		selectedReleases = new Set<string>();
		releaseSearchStore.clear();
		selectedSeason = null;
	}

	function handleCancel() {
		open = false;
		resetState();
	}

	function resetState() {
		step = 1;
		selectedInstanceId = null;
		libraryItems = [];
		searchStore.clear();
		selectedItem = null;
		releases = [];
		selectedReleases = new Set<string>();
		releaseSearchStore.clear();
		sortField = 'size';
		sortDirection = 'desc';
		selectedSeason = null;
	}

	$: canConfirm =
		step === 1
			? selectedItem !== null
			: entity?.type === 'series' && selectedSeason === null
				? false
				: selectedReleases.size > 0;
	$: confirmText = step === 1 ? 'Next' : `Import (${selectedReleases.size})`;
	$: headerText =
		step === 1
			? 'Import Releases'
			: entity?.type === 'series' && selectedSeason === null
				? 'Select Season'
				: 'Select Releases';

	// Build the releases JSON for form submission
	$: releasesJson = JSON.stringify(
		releases
			.filter((r) => selectedReleases.has(r.title))
			.map((r) => ({
				entityType: entity?.type ?? 'movie',
				entityTmdbId: entity?.tmdb_id ?? 0,
				title: r.title,
				size_bytes: r.size,
				languages: r.languages,
				indexers: r.indexers,
				flags: r.flags
			}))
	);
</script>

<Modal
	bind:open
	header={headerText}
	{confirmText}
	confirmDisabled={!canConfirm}
	size="xl"
	height="lg"
	on:cancel={step === 2 ? handleBack : handleCancel}
	on:confirm={handleConfirm}
>
	<div slot="body" class="space-y-4">
		<!-- Entity Info -->
		{#if entity}
			<Card padding="sm" flush>
				<div class="flex items-center gap-3">
					{#if entity.poster_path}
						<img
							src="https://image.tmdb.org/t/p/w92{entity.poster_path}"
							alt={entity.title}
							class="h-16 w-11 rounded object-cover"
						/>
					{:else}
						<div
							class="flex h-16 w-11 items-center justify-center rounded bg-neutral-200 dark:bg-neutral-700"
						>
							{#if entity.type === 'movie'}
								<Film size={20} class="text-neutral-400" />
							{:else}
								<Tv size={20} class="text-neutral-400" />
							{/if}
						</div>
					{/if}
					<div>
						<h3 class="font-medium text-neutral-900 dark:text-neutral-100">{entity.title}</h3>
						<p class="text-sm text-neutral-500 dark:text-neutral-400">
							{entity.type === 'movie' ? 'Movie' : 'TV Series'}
							{#if entity.year}
								• {entity.year}
							{/if}
						</p>
					</div>
				</div>
			</Card>
		{/if}

		{#if step === 1}
			<!-- Step 1: Select Library Item -->
			{#if filteredInstances.length === 0}
				<Card flush>
					<p class="text-sm text-neutral-600 dark:text-neutral-300">
						No {entity?.type === 'movie' ? 'Radarr' : 'Sonarr'} instances configured.
						<a
							href="/settings/arr"
							class="font-medium text-accent-600 hover:underline dark:text-accent-400"
						>
							Configure in Settings
						</a>
					</p>
				</Card>
			{:else}
				<ActionsBar>
					<SearchAction {searchStore} placeholder="Search library..." />
					<ActionButton
						icon={Server}
						hasDropdown={true}
						dropdownPosition="right"
						square={!selectedInstance}
					>
						{#if selectedInstance}
							<span class="ml-2 text-sm text-neutral-700 dark:text-neutral-300"
								>{selectedInstance.name}</span
							>
						{/if}
						<svelte:fragment slot="dropdown" let:dropdownPosition>
							<Dropdown position={dropdownPosition}>
								<DropdownHeader label="Instance" />
								{#each filteredInstances as instance}
									<DropdownItem
										label={instance.name}
										selected={selectedInstanceId === instance.id}
										on:click={() => selectInstance(instance.id)}
									/>
								{/each}
							</Dropdown>
						</svelte:fragment>
					</ActionButton>
				</ActionsBar>

				<!-- Library Selection -->
				{#if selectedInstanceId}
					{#if loadingLibrary}
						<div class="flex items-center justify-center p-8">
							<Loader2 size={24} class="animate-spin text-neutral-400" />
						</div>
					{:else if libraryItems.length === 0}
						<Card padding="lg">
							<p class="text-center text-neutral-500 dark:text-neutral-400">
								No items found in library.
							</p>
						</Card>
					{:else}
						<!-- Potential Matches -->
						{#if potentialMatches.length > 0}
							<div class="space-y-2">
								<p class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
									Suggested Match
								</p>
								<SelectableContainer>
									{#each potentialMatches as item}
										<SelectableRow
											checked={selectedItem?.id === item.id}
											on:click={() => (selectedItem = selectedItem?.id === item.id ? null : item)}
										>
											<p
												class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100"
											>
												{item.title}
											</p>
											{#if item.year}
												<p class="text-xs text-neutral-500 dark:text-neutral-400">
													{item.year}
												</p>
											{/if}
										</SelectableRow>
									{/each}
								</SelectableContainer>
							</div>
						{:else}
							<p class="text-xs text-neutral-500 italic dark:text-neutral-400">
								This item might not be in your library. Select manually below.
							</p>
						{/if}

						<!-- All Items -->
						<div class="space-y-2">
							{#if potentialMatches.length > 0}
								<p class="text-xs font-medium text-neutral-500 dark:text-neutral-400">All Items</p>
							{/if}
							<SelectableContainer>
								{#each filteredLibrary as item}
									<SelectableRow
										checked={selectedItem?.id === item.id}
										on:click={() => (selectedItem = selectedItem?.id === item.id ? null : item)}
									>
										<p class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
											{item.title}
										</p>
										{#if item.year}
											<p class="text-xs text-neutral-500 dark:text-neutral-400">
												{item.year}
											</p>
										{/if}
									</SelectableRow>
								{/each}
							</SelectableContainer>
						</div>
					{/if}
				{:else}
					<Card padding="lg">
						<p class="text-center text-neutral-500 dark:text-neutral-400">
							Select an instance to load library.
						</p>
					</Card>
				{/if}
			{/if}
		{:else}
			<!-- Step 2: Select Releases -->
			{#if entity?.type === 'series' && selectedSeason === null}
				<!-- Season Selection for TV Series -->
				<div class="space-y-3">
					<p class="text-sm text-neutral-600 dark:text-neutral-400">
						Select a season to search for releases:
					</p>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{#each selectedItem?.seasons || [] as season}
							<Card hoverable padding="sm" onclick={() => changeSeason(season)}>
								<p class="text-center text-sm font-medium text-neutral-900 dark:text-neutral-100">
									Season {season}
								</p>
							</Card>
						{/each}
					</div>
				</div>
			{:else if loadingReleases}
				<div class="flex flex-col items-center justify-center gap-2 p-8">
					<Loader2 size={24} class="animate-spin text-neutral-400" />
					<p class="text-sm text-neutral-500 dark:text-neutral-400">
						Searching indexers{entity?.type === 'series' ? ` for season ${selectedSeason}` : ''}...
					</p>
				</div>
			{:else}
				<!-- Season buttons for switching (TV series only) -->
				{#if entity?.type === 'series' && selectedItem?.seasons}
					<div class="flex flex-wrap gap-2">
						{#each selectedItem.seasons as season}
							<Button
								text="S{season}"
								variant={selectedSeason === season ? 'primary' : 'secondary'}
								size="sm"
								on:click={() => changeSeason(season)}
							/>
						{/each}
					</div>
				{/if}

				<ActionsBar>
					<SearchAction searchStore={releaseSearchStore} placeholder="Search releases..." />
					<ActionButton
						icon={sortDirection === 'asc' ? ArrowUpAZ : ArrowDownAZ}
						hasDropdown={true}
						dropdownPosition="right"
					>
						<svelte:fragment slot="dropdown" let:dropdownPosition>
							<Dropdown position={dropdownPosition}>
								<DropdownItem
									label="Title"
									selected={sortField === 'title'}
									on:click={() => setSortField('title')}
								/>
								<DropdownItem
									label="Size"
									selected={sortField === 'size'}
									on:click={() => setSortField('size')}
								/>
								<DropdownItem
									label="Indexers"
									selected={sortField === 'indexers'}
									on:click={() => setSortField('indexers')}
								/>
							</Dropdown>
						</svelte:fragment>
					</ActionButton>
					<ActionButton icon={CircuitBoard} hasDropdown={true} dropdownPosition="right">
						<svelte:fragment slot="dropdown" let:dropdownPosition>
							<Dropdown position={dropdownPosition}>
								<DropdownItem
									label={allFilteredSelected ? 'Deselect All' : 'Select All'}
									on:click={selectAllReleases}
								/>
							</Dropdown>
						</svelte:fragment>
					</ActionButton>
				</ActionsBar>

				{#if releases.length === 0}
					<Card padding="lg">
						<p class="text-center text-neutral-500 dark:text-neutral-400">
							No releases found{entity?.type === 'series' ? ` for season ${selectedSeason}` : ''}.
						</p>
					</Card>
				{:else}
					<SelectableContainer>
						{#each filteredReleases as release}
							<SelectableRow
								checked={selectedReleases.has(release.title)}
								on:click={() => toggleRelease(release.title)}
							>
								<p class="truncate font-mono text-xs text-neutral-900 dark:text-neutral-100">
									{release.title}
								</p>
								<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
									<span class="font-mono text-xs text-neutral-500 dark:text-neutral-400"
										>{formatSize(release.size)}</span
									>
									{#if release.languages.length > 0}
										<span class="text-xs text-neutral-400">•</span>
										<span class="text-xs text-neutral-500 dark:text-neutral-400"
											>{release.languages.join(', ')}</span
										>
									{/if}
									{#each release.indexers as indexer}
										<Badge variant="neutral">{indexer}</Badge>
									{/each}
									{#each release.flags as flag}
										<Badge variant="accent">{flag}</Badge>
									{/each}
								</div>
							</SelectableRow>
						{/each}
					</SelectableContainer>
				{/if}
			{/if}
		{/if}

		<!-- Hidden form for submission -->
		<form
			bind:this={formRef}
			method="POST"
			action="?/importReleases"
			class="hidden"
			use:enhance={() => {
				saving = true;
				return async ({ result, update }) => {
					if (result.type === 'failure' && result.data) {
						alertStore.add(
							'error',
							(result.data as { error?: string }).error || 'Failed to import releases'
						);
					} else if (result.type === 'success') {
						const data = result.data as { added?: number; skipped?: number };
						const added = data?.added ?? 0;
						const skipped = data?.skipped ?? 0;

						if (added === 0 && skipped > 0) {
							alertStore.add(
								'info',
								`All ${skipped} ${skipped === 1 ? 'release already exists' : 'releases already exist'}`
							);
						} else if (skipped > 0) {
							alertStore.add(
								'success',
								`Imported ${added} ${added === 1 ? 'release' : 'releases'}, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}`
							);
						} else {
							alertStore.add(
								'success',
								`Imported ${added} ${added === 1 ? 'release' : 'releases'}`
							);
						}
						open = false;
						resetState();
					}
					await update();
					saving = false;
				};
			}}
		>
			<input type="hidden" name="releases" value={releasesJson} />
			<input type="hidden" name="layer" value={selectedLayer} />
		</form>
	</div>
</Modal>
