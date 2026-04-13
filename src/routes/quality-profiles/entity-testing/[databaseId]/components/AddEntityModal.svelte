<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { Film, Tv, Star, Loader2, Clapperboard, X, ArrowDownAZ, ArrowUpAZ } from 'lucide-svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import Label from '$ui/label/Label.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SelectableContainer from '$ui/toggle/SelectableContainer.svelte';
	import SelectableRow from '$ui/toggle/SelectableRow.svelte';
	import { getPersistentSearchStore, type SearchStore } from '$stores/search';
	import { alertStore } from '$alerts/store';
	import { page } from '$app/stores';

	export let open = false;
	export let actionUrl: string = '?/addEntities';
	export let existingEntities: Array<{ type: 'movie' | 'series'; tmdb_id: number }> = [];
	export let canWriteToBase: boolean = false;
	export let tmdbConfigured: boolean = true;

	let saving = false;
	let formRef: HTMLFormElement;

	// Layer selection
	let selectedLayer: 'user' | 'base' = canWriteToBase ? 'base' : 'user';

	type ResultItem = {
		id: number;
		type: 'movie' | 'series';
		title: string;
		overview: string;
		posterPath: string | null;
		releaseDate: string;
		voteAverage: number;
		popularity: number;
	};

	// Sort state
	type SortField = 'popularity' | 'rating' | 'title' | 'year';
	type SortDirection = 'asc' | 'desc';
	let sortField: SortField = 'popularity';
	let sortDirection: SortDirection = 'desc';

	function setSortField(field: SortField) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = field === 'title' ? 'asc' : 'desc';
		}
	}

	// Build set of existing entity keys for quick lookup
	$: existingKeys = new Set(existingEntities.map((e) => `${e.type}-${e.tmdb_id}`));

	function isAlreadyAdded(item: ResultItem): boolean {
		return existingKeys.has(`${item.type}-${item.id}`);
	}

	let searchStore: SearchStore;
	$: searchStore = getPersistentSearchStore(
		`entityTestingAddEntitySearch:${$page.params.databaseId}`
	);

	let activeQuery = '';
	let isSearching = false;
	let results: ResultItem[] = [];
	let selectedItems: Map<string, ResultItem> = new Map();
	let selectedKeys: Set<string> = new Set();

	function getItemKey(item: ResultItem): string {
		return `${item.type}-${item.id}`;
	}

	function toggleItem(item: ResultItem) {
		const key = getItemKey(item);
		if (selectedItems.has(key)) {
			selectedItems.delete(key);
			selectedKeys.delete(key);
		} else {
			selectedItems.set(key, item);
			selectedKeys.add(key);
		}
		selectedItems = selectedItems;
		selectedKeys = selectedKeys;
	}

	function removeItem(item: ResultItem) {
		const key = getItemKey(item);
		selectedItems.delete(key);
		selectedKeys.delete(key);
		selectedItems = selectedItems;
		selectedKeys = selectedKeys;
	}

	// Filter state
	let moviesSelected = true;
	let seriesSelected = true;

	function toggleMovies() {
		if (moviesSelected && !seriesSelected) return;
		moviesSelected = !moviesSelected;
	}

	function toggleSeries() {
		if (seriesSelected && !moviesSelected) return;
		seriesSelected = !seriesSelected;
	}

	$: searchType = moviesSelected && seriesSelected ? 'both' : moviesSelected ? 'movie' : 'tv';

	// Sorted results
	$: sortedResults = (() => {
		const sorted = [...results];
		sorted.sort((a, b) => {
			let cmp = 0;
			if (sortField === 'popularity') {
				cmp = a.popularity - b.popularity;
			} else if (sortField === 'rating') {
				cmp = a.voteAverage - b.voteAverage;
			} else if (sortField === 'title') {
				cmp = a.title.localeCompare(b.title);
			} else if (sortField === 'year') {
				const yearA = a.releaseDate ? parseInt(a.releaseDate.split('-')[0], 10) : 0;
				const yearB = b.releaseDate ? parseInt(b.releaseDate.split('-')[0], 10) : 0;
				cmp = yearA - yearB;
			}
			return sortDirection === 'asc' ? cmp : -cmp;
		});
		return sorted;
	})();

	async function handleSubmit(e: CustomEvent<string>) {
		const query = e.detail;
		if (!query) return;

		activeQuery = query;
		searchStore.clear();
		isSearching = true;

		try {
			const params = new URLSearchParams({
				query,
				type: searchType
			});
			const response = await fetch(`/tmdb/search?${params}`);
			const data = await response.json();

			if (data.error) {
				alertStore.add('error', data.error);
				results = [];
			} else {
				results = data.results;
			}
		} catch (err) {
			alertStore.add('error', err instanceof Error ? err.message : 'Search failed');
			results = [];
		} finally {
			isSearching = false;
		}
	}

	function clearSearch() {
		activeQuery = '';
		results = [];
	}

	async function handleConfirm() {
		if (selectedItems.size === 0) return;
		selectedLayer = canWriteToBase ? 'base' : 'user';
		await tick();
		formRef?.requestSubmit();
	}

	function handleCancel() {
		open = false;
		resetState();
	}

	function resetState() {
		searchStore.clear();
		activeQuery = '';
		results = [];
		selectedItems = new Map();
		selectedKeys = new Set();
		sortField = 'popularity';
		sortDirection = 'desc';
	}

	function getYear(dateString: string): string {
		if (!dateString) return '';
		return dateString.split('-')[0];
	}

	function getPosterUrl(path: string | null): string {
		if (!path) return '';
		return `https://image.tmdb.org/t/p/w92${path}`;
	}

	$: entitiesJson = JSON.stringify(
		Array.from(selectedItems.values()).map((item) => ({
			type: item.type,
			tmdbId: item.id,
			title: item.title,
			year: item.releaseDate ? parseInt(item.releaseDate.split('-')[0], 10) : null,
			posterPath: item.posterPath
		}))
	);
</script>

<Modal
	bind:open
	header="Add Test Entity"
	confirmText="Add"
	confirmDisabled={!tmdbConfigured}
	size="xl"
	bodyOverflow="visible"
	on:cancel={handleCancel}
	on:confirm={handleConfirm}
>
	<div slot="body" class="space-y-4">
		{#if !tmdbConfigured}
			<div
				class="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800"
			>
				<p class="text-sm text-neutral-600 dark:text-neutral-300">
					TMDB API key not configured. Please add your API key in
					<a
						href="/settings/general"
						class="font-medium text-accent-600 hover:underline dark:text-accent-400">Settings</a
					>
					to search for movies and TV series.
				</p>
			</div>
		{:else}
			<!-- Search Bar -->
			<ActionsBar>
				<SearchAction
					{searchStore}
					placeholder="Search TMDB... (press Enter)"
					{activeQuery}
					on:submit={handleSubmit}
					on:clearQuery={clearSearch}
				/>
				<ActionButton icon={Clapperboard} hasDropdown={true} dropdownPosition="right">
					<svelte:fragment slot="dropdown" let:dropdownPosition>
						<Dropdown position={dropdownPosition}>
							<DropdownHeader label="Media type" />
							<DropdownItem
								icon={Film}
								label="Movies"
								selected={moviesSelected}
								on:click={toggleMovies}
							/>
							<DropdownItem
								icon={Tv}
								label="TV Series"
								selected={seriesSelected}
								on:click={toggleSeries}
							/>
						</Dropdown>
					</svelte:fragment>
				</ActionButton>
				<ActionButton
					icon={sortDirection === 'asc' ? ArrowUpAZ : ArrowDownAZ}
					hasDropdown={true}
					dropdownPosition="right"
				>
					<svelte:fragment slot="dropdown" let:dropdownPosition>
						<Dropdown position={dropdownPosition}>
							<DropdownHeader label="Sort by" />
							<DropdownItem
								label="Popularity"
								selected={sortField === 'popularity'}
								on:click={() => setSortField('popularity')}
							/>
							<DropdownItem
								label="Rating"
								selected={sortField === 'rating'}
								on:click={() => setSortField('rating')}
							/>
							<DropdownItem
								label="Title"
								selected={sortField === 'title'}
								on:click={() => setSortField('title')}
							/>
							<DropdownItem
								label="Year"
								selected={sortField === 'year'}
								on:click={() => setSortField('year')}
							/>
						</Dropdown>
					</svelte:fragment>
				</ActionButton>
			</ActionsBar>

			<!-- Results -->
			{#if isSearching || activeQuery || results.length > 0}
				<div
					class="max-h-96 overflow-hidden overflow-y-auto rounded-xl border border-neutral-300 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50"
				>
					{#if isSearching}
						<div class="flex items-center justify-center p-8">
							<Loader2 size={24} class="animate-spin text-neutral-400" />
						</div>
					{:else if results.length === 0}
						<div class="p-8 text-center text-neutral-500 dark:text-neutral-400">
							No results found
						</div>
					{:else}
						<SelectableContainer>
							{#each sortedResults as item}
								{@const alreadyAdded = isAlreadyAdded(item)}
								<SelectableRow
									checked={selectedKeys.has(getItemKey(item))}
									disabled={alreadyAdded}
									on:click={() => !alreadyAdded && toggleItem(item)}
								>
									<div class="flex gap-3">
										<!-- Poster -->
										<div
											class="h-24 w-16 flex-shrink-0 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-700"
										>
											{#if item.posterPath}
												<img
													src={getPosterUrl(item.posterPath)}
													alt={item.title}
													class="h-full w-full object-cover"
												/>
											{:else}
												<div class="flex h-full w-full items-center justify-center">
													{#if item.type === 'movie'}
														<Film size={24} class="text-neutral-400" />
													{:else}
														<Tv size={24} class="text-neutral-400" />
													{/if}
												</div>
											{/if}
										</div>

										<!-- Info -->
										<div class="flex min-w-0 flex-1 flex-col">
											<div class="flex items-start gap-2">
												<div class="min-w-0 flex-1">
													<h4 class="truncate font-medium text-neutral-900 dark:text-neutral-100">
														{item.title}
													</h4>
													<div
														class="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400"
													>
														<span class="flex items-center gap-1">
															{#if item.type === 'movie'}
																<Film size={12} />
																Movie
															{:else}
																<Tv size={12} />
																TV Series
															{/if}
														</span>
														{#if getYear(item.releaseDate)}
															<span>•</span>
															<span>{getYear(item.releaseDate)}</span>
														{/if}
													</div>
												</div>
												{#if item.voteAverage > 0}
													<Badge variant="accent" size="sm" icon={Star}>
														{item.voteAverage.toFixed(1)}
													</Badge>
												{/if}
											</div>
											<p class="mt-1 line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">
												{item.overview || 'No description available'}
											</p>
										</div>
									</div>
								</SelectableRow>
							{/each}
						</SelectableContainer>
					{/if}
				</div>
			{/if}

			<!-- Selected Items -->
			<div class="space-y-2">
				<div class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
					Selected ({selectedItems.size})
				</div>
				<div class="flex flex-wrap gap-2">
					{#each Array.from(selectedItems.values()) as item}
						<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
						<div class="cursor-pointer" on:click={() => removeItem(item)}>
							<Label variant="secondary" size="md" rounded="md">
								{#if item.type === 'movie'}
									<Film size={12} />
								{:else}
									<Tv size={12} />
								{/if}
								{item.title}
								<X size={12} />
							</Label>
						</div>
					{/each}
				</div>
			</div>

			<form
				bind:this={formRef}
				method="POST"
				action={actionUrl}
				class="hidden"
				use:enhance={() => {
					saving = true;
					return async ({ result, update }) => {
						if (result.type === 'failure' && result.data) {
							alertStore.add(
								'error',
								(result.data as { error?: string }).error || 'Failed to add entities'
							);
						} else if (result.type === 'success') {
							const data = result.data as { added?: number; skipped?: number };
							const added = data?.added ?? 0;
							const skipped = data?.skipped ?? 0;

							if (added === 0 && skipped > 0) {
								alertStore.add(
									'info',
									`All ${skipped} ${skipped === 1 ? 'entity already exists' : 'entities already exist'}`
								);
							} else if (skipped > 0) {
								alertStore.add(
									'success',
									`Added ${added} ${added === 1 ? 'entity' : 'entities'}, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}`
								);
							} else {
								alertStore.add(
									'success',
									`Added ${added} test ${added === 1 ? 'entity' : 'entities'}`
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
				<input type="hidden" name="entities" value={entitiesJson} />
				<input type="hidden" name="layer" value={selectedLayer} />
			</form>
		{/if}
	</div>
</Modal>
