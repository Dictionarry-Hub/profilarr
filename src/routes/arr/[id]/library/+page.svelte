<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { AlertTriangle, Film } from 'lucide-svelte';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import type { RadarrLibraryItem, SonarrLibraryItem } from '$utils/arr/types.ts';
	import { libraryCache } from '$stores/libraryCache';
	import { sortTitle } from '$shared/utils/sort.ts';
	import { getPersistentSearchStore } from '$stores/search';
	import type { FilterFieldDef, FilterTag } from '$ui/filter/types';
	import { applySmartFilters } from '$ui/filter/match';
	import type { ViewMode } from '$lib/client/stores/dataPage';
	import { createProgressiveList } from '$lib/client/utils/progressiveList';
	import InfoModal from '$ui/modal/InfoModal.svelte';

	import LibraryActionBar from './components/LibraryActionBar.svelte';
	import RadarrTableView from './components/RadarrTableView.svelte';
	import SonarrTableView from './components/SonarrTableView.svelte';
	import LibraryCardGrid from './components/LibraryCardGrid.svelte';
	import MovieCard from './components/MovieCard.svelte';
	import SeriesCard from './components/SeriesCard.svelte';

	export let data: PageData;

	$: isRadarr = data.instance.type === 'radarr';
	$: isSonarr = data.instance.type === 'sonarr';
	$: isSupported = isRadarr || isSonarr;

	// ==========================================================================
	// Smart Filter
	// ==========================================================================

	let filterTags: FilterTag[] = [];
	let showFilterInfo = false;

	// Mobile simple search
	$: mobileSearchStore = getPersistentSearchStore(`arrLibrarySearch:${data.instance.id}`, {
		debounceMs: 150
	});
	$: mobileQuery = $mobileSearchStore.query;

	const radarrFields: FilterFieldDef<RadarrLibraryItem>[] = [
		{
			key: 'title',
			label: 'Title',
			type: 'text',
			accessor: (m) => m.title,
			isDefault: true,
			suggestions: (items) => items.map((m) => m.title).sort()
		},
		{
			key: 'quality',
			label: 'Quality',
			type: 'text',
			accessor: (m) => m.qualityName ?? '',
			suggestions: (items) =>
				[...new Set(items.map((m) => m.qualityName).filter(Boolean) as string[])].sort()
		},
		{
			key: 'profile',
			label: 'Profile',
			type: 'text',
			accessor: (m) => m.qualityProfileName,
			suggestions: (items) => [...new Set(items.map((m) => m.qualityProfileName))].sort()
		},
		{
			key: 'format',
			label: 'Format',
			type: 'text',
			accessor: (m) => m.scoreBreakdown.map((s) => s.name),
			suggestions: (items) =>
				[...new Set(items.flatMap((m) => m.scoreBreakdown.map((s) => s.name)))].sort()
		},
		{ key: 'score', label: 'Score', type: 'number', accessor: (m) => m.customFormatScore },
		{ key: 'year', label: 'Year', type: 'number', accessor: (m) => m.year ?? 0 },
		{
			key: 'status',
			label: 'Status',
			type: 'text',
			accessor: (m) => m.status ?? '',
			suggestions: () => ['released', 'announced', 'inCinemas']
		},
		{
			key: 'studio',
			label: 'Studio',
			type: 'text',
			accessor: (m) => m.studio ?? '',
			suggestions: (items) =>
				[...new Set(items.map((m) => m.studio).filter(Boolean) as string[])].sort()
		},
		{
			key: 'genre',
			label: 'Genre',
			type: 'text',
			accessor: (m) => m.genres ?? [],
			suggestions: (items) => [...new Set(items.flatMap((m) => m.genres ?? []))].sort()
		},
		{
			key: 'monitored',
			label: 'Monitored',
			type: 'text',
			accessor: (m) => (m.monitored ? 'yes' : 'no'),
			suggestions: () => ['yes', 'no']
		}
	];

	const sonarrFields: FilterFieldDef<SonarrLibraryItem>[] = [
		{
			key: 'title',
			label: 'Title',
			type: 'text',
			accessor: (s) => s.title,
			isDefault: true,
			suggestions: (items) => items.map((s) => s.title).sort()
		},
		{
			key: 'profile',
			label: 'Profile',
			type: 'text',
			accessor: (s) => s.qualityProfileName,
			suggestions: (items) => [...new Set(items.map((s) => s.qualityProfileName))].sort()
		},
		{
			key: 'network',
			label: 'Network',
			type: 'text',
			accessor: (s) => s.network ?? '',
			suggestions: (items) =>
				[...new Set(items.map((s) => s.network).filter(Boolean) as string[])].sort()
		},
		{ key: 'year', label: 'Year', type: 'number', accessor: (s) => s.year ?? 0 },
		{
			key: 'status',
			label: 'Status',
			type: 'text',
			accessor: (s) => s.status ?? '',
			suggestions: () => ['continuing', 'ended', 'upcoming']
		},
		{
			key: 'genre',
			label: 'Genre',
			type: 'text',
			accessor: (s) => s.genres ?? [],
			suggestions: (items) => [...new Set(items.flatMap((s) => s.genres ?? []))].sort()
		},
		{
			key: 'monitored',
			label: 'Monitored',
			type: 'text',
			accessor: (s) => (s.monitored ? 'yes' : 'no'),
			suggestions: () => ['yes', 'no']
		}
	];

	$: activeFields = isRadarr ? radarrFields : sonarrFields;

	// ==========================================================================
	// View Mode
	// ==========================================================================

	const VIEW_STORAGE_KEY = 'profilarr-library-view';
	function loadViewMode(): ViewMode {
		if (!browser) return 'table';
		try {
			const stored = localStorage.getItem(VIEW_STORAGE_KEY);
			if (stored === 'cards' || stored === 'table') return stored;
		} catch {}
		return window.innerWidth < 768 ? 'cards' : 'table';
	}

	let viewMode: ViewMode = loadViewMode();

	$: if (browser) {
		localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
	}

	// ==========================================================================
	// Expand All
	// ==========================================================================

	const EXPAND_ALL_STORAGE_KEY = 'profilarr-library-expand-all';

	function loadExpandAll(): boolean {
		if (!browser) return false;
		try {
			return localStorage.getItem(EXPAND_ALL_STORAGE_KEY) === 'true';
		} catch {}
		return false;
	}

	let expandAll = loadExpandAll();

	function toggleExpandAll() {
		expandAll = !expandAll;
		if (browser) {
			localStorage.setItem(EXPAND_ALL_STORAGE_KEY, String(expandAll));
		}
	}

	// ==========================================================================
	// Library Data State
	// ==========================================================================

	let library: RadarrLibraryItem[] | SonarrLibraryItem[] = [];
	let libraryError: string | null = null;
	let profilesByDatabase: { databaseId: number; databaseName: string; profiles: string[] }[] = [];
	let loading = true;
	let refreshing = false;

	// Cache age tracking
	let cacheAgeTick = 0;
	let cacheAgeInterval: ReturnType<typeof setInterval>;

	function formatCacheAge(seconds: number): string {
		if (seconds < 60) return 'just now';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		if (remainingMinutes === 0) return `${hours}h ago`;
		return `${hours}h ${remainingMinutes}m ago`;
	}

	$: cacheAgeSeconds = (() => {
		cacheAgeTick;
		return libraryCache.getAge(data.instance.id);
	})();
	$: cacheAgeText = cacheAgeSeconds !== null ? formatCacheAge(cacheAgeSeconds) : null;

	async function fetchLibrary(force = false) {
		const instanceId = data.instance.id;

		// Check client cache first (unless forcing refresh)
		if (!force && libraryCache.has(instanceId)) {
			const cached = libraryCache.get(instanceId)!;
			library = cached.data;
			profilesByDatabase = cached.profilesByDatabase;
			libraryError = null;
			loading = false;
			return;
		}

		// Fetch from API
		try {
			if (force) {
				// Clear server cache first
				await fetch(`/api/v1/arr/library?instanceId=${instanceId}`, { method: 'DELETE' });
			}

			const response = await fetch(`/api/v1/arr/library?instanceId=${instanceId}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch library: ${response.statusText}`);
			}

			const result = await response.json();
			library = result.items;
			libraryError = null;
			profilesByDatabase = result.profilesByDatabase;

			// Cache the result
			libraryCache.set(instanceId, result.items, result.profilesByDatabase);
		} catch (err) {
			libraryError = err instanceof Error ? err.message : 'Failed to fetch library';
		} finally {
			loading = false;
			refreshing = false;
		}
	}

	async function handleRefresh() {
		refreshing = true;
		libraryCache.invalidate(data.instance.id);
		if (isSonarr) {
			sonarrTableView?.resetEpisodeCache();
		}
		await fetchLibrary(true);
	}

	function handleOpen() {
		const baseUrl = data.instance.url.replace(/\/$/, '');
		window.open(baseUrl, '_blank', 'noopener,noreferrer');
	}

	let currentInstanceId: number | null = null;

	onMount(() => {
		currentInstanceId = data.instance.id;
		fetchLibrary();
		cacheAgeInterval = setInterval(() => {
			cacheAgeTick++;
		}, 30000); // Update age display every 30s
	});

	onDestroy(() => {
		if (cacheAgeInterval) clearInterval(cacheAgeInterval);
	});

	// Refetch if instance changes (navigation between instances)
	$: if (browser && data.instance.id && data.instance.id !== currentInstanceId) {
		currentInstanceId = data.instance.id;
		loading = true;
		sonarrTableView?.resetEpisodeCache();
		fetchLibrary();
	}

	// ==========================================================================
	// Column Visibility (Radarr)
	// ==========================================================================

	const RADARR_STORAGE_KEY = 'profilarr-library-columns';
	const RADARR_TOGGLEABLE_COLUMNS = [
		'status',
		'qualityName',
		'score',
		'sizeOnDisk',
		'popularity',
		'dateAdded',
		'releaseGroup'
	] as const;
	type RadarrToggleableColumn = (typeof RADARR_TOGGLEABLE_COLUMNS)[number];

	function loadRadarrColumnVisibility(): Set<RadarrToggleableColumn> {
		if (!browser) return new Set(RADARR_TOGGLEABLE_COLUMNS);
		try {
			const stored = localStorage.getItem(RADARR_STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as RadarrToggleableColumn[];
				return new Set(parsed);
			}
		} catch {}
		return new Set(RADARR_TOGGLEABLE_COLUMNS);
	}

	function saveRadarrColumnVisibility(visible: Set<RadarrToggleableColumn>) {
		if (!browser) return;
		localStorage.setItem(RADARR_STORAGE_KEY, JSON.stringify([...visible]));
	}

	let radarrVisibleColumns = loadRadarrColumnVisibility();

	function toggleRadarrColumn(key: string) {
		const colKey = key as RadarrToggleableColumn;
		if (radarrVisibleColumns.has(colKey)) {
			radarrVisibleColumns.delete(colKey);
		} else {
			radarrVisibleColumns.add(colKey);
		}
		radarrVisibleColumns = radarrVisibleColumns;
		saveRadarrColumnVisibility(radarrVisibleColumns);
	}

	const radarrColumnLabels: Record<RadarrToggleableColumn, string> = {
		qualityName: 'Quality',
		score: 'Score',
		releaseGroup: 'Group',
		sizeOnDisk: 'Size',
		status: 'Status',
		popularity: 'Popularity',
		dateAdded: 'Added'
	};

	// ==========================================================================
	// Column Visibility (Sonarr)
	// ==========================================================================

	const SONARR_STORAGE_KEY = 'profilarr-library-sonarr-columns';
	const SONARR_TOGGLEABLE_COLUMNS = ['status', 'episodes', 'sizeOnDisk', 'dateAdded'] as const;
	type SonarrToggleableColumn = (typeof SONARR_TOGGLEABLE_COLUMNS)[number];

	function loadSonarrColumnVisibility(): Set<SonarrToggleableColumn> {
		if (!browser) return new Set(SONARR_TOGGLEABLE_COLUMNS);
		try {
			const stored = localStorage.getItem(SONARR_STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as SonarrToggleableColumn[];
				return new Set(parsed);
			}
		} catch {}
		return new Set(SONARR_TOGGLEABLE_COLUMNS);
	}

	function saveSonarrColumnVisibility(visible: Set<SonarrToggleableColumn>) {
		if (!browser) return;
		localStorage.setItem(SONARR_STORAGE_KEY, JSON.stringify([...visible]));
	}

	let sonarrVisibleColumns = loadSonarrColumnVisibility();

	function toggleSonarrColumn(key: string) {
		const colKey = key as SonarrToggleableColumn;
		if (sonarrVisibleColumns.has(colKey)) {
			sonarrVisibleColumns.delete(colKey);
		} else {
			sonarrVisibleColumns.add(colKey);
		}
		sonarrVisibleColumns = sonarrVisibleColumns;
		saveSonarrColumnVisibility(sonarrVisibleColumns);
	}

	const sonarrColumnLabels: Record<SonarrToggleableColumn, string> = {
		episodes: 'Episodes',
		sizeOnDisk: 'Size',
		status: 'Status',
		dateAdded: 'Added'
	};

	// ==========================================================================
	// Unified column toggle (delegates based on type)
	// ==========================================================================

	$: activeToggleableColumns = isRadarr ? RADARR_TOGGLEABLE_COLUMNS : SONARR_TOGGLEABLE_COLUMNS;
	$: activeColumnLabels = isRadarr ? radarrColumnLabels : sonarrColumnLabels;
	$: activeVisibleColumns = isRadarr
		? new Set([...radarrVisibleColumns])
		: new Set([...sonarrVisibleColumns]);

	function toggleColumn(key: string) {
		if (isRadarr) {
			toggleRadarrColumn(key);
		} else {
			toggleSonarrColumn(key);
		}
	}

	// ==========================================================================
	// Card Field Visibility
	// ==========================================================================

	const RADARR_CARD_STORAGE_KEY = 'profilarr-library-card-fields';
	const RADARR_CARD_FIELDS = [
		'monitored',
		'title',
		'profile',
		'size',
		'score',
		'quality',
		'year',
		'releaseGroup',
		'status',
		'popularity',
		'runtime',
		'rating',
		'dateAdded'
	] as const;
	const RADARR_CARD_DEFAULTS: readonly string[] = ['monitored', 'profile', 'size', 'score'];
	type RadarrCardField = (typeof RADARR_CARD_FIELDS)[number];

	const radarrCardFieldLabels: Record<RadarrCardField, string> = {
		monitored: 'Monitored',
		title: 'Title',
		profile: 'Profile',
		size: 'Size',
		score: 'Score',
		quality: 'Quality',
		year: 'Year',
		releaseGroup: 'Release Group',
		status: 'Status',
		popularity: 'Popularity',
		runtime: 'Runtime',
		rating: 'Rating',
		dateAdded: 'Date Added'
	};

	const SONARR_CARD_STORAGE_KEY = 'profilarr-library-card-fields-sonarr';
	const SONARR_CARD_FIELDS = [
		'monitored',
		'title',
		'profile',
		'size',
		'episodes',
		'year',
		'status',
		'rating',
		'dateAdded'
	] as const;
	const SONARR_CARD_DEFAULTS: readonly string[] = ['monitored', 'profile', 'size', 'episodes'];
	type SonarrCardField = (typeof SONARR_CARD_FIELDS)[number];

	const sonarrCardFieldLabels: Record<SonarrCardField, string> = {
		monitored: 'Monitored',
		title: 'Title',
		profile: 'Profile',
		size: 'Size',
		episodes: 'Episodes',
		year: 'Year',
		status: 'Status',
		rating: 'Rating',
		dateAdded: 'Date Added'
	};

	function loadCardFields<T extends string>(key: string, defaults: readonly string[]): Set<T> {
		if (!browser) return new Set(defaults as T[]);
		try {
			const stored = localStorage.getItem(key);
			if (stored) return new Set(JSON.parse(stored) as T[]);
		} catch {}
		return new Set(defaults as T[]);
	}

	let radarrCardFields = loadCardFields<RadarrCardField>(
		RADARR_CARD_STORAGE_KEY,
		RADARR_CARD_DEFAULTS
	);
	let sonarrCardFields = loadCardFields<SonarrCardField>(
		SONARR_CARD_STORAGE_KEY,
		SONARR_CARD_DEFAULTS
	);

	function toggleCardField(key: string) {
		if (isRadarr) {
			const k = key as RadarrCardField;
			if (radarrCardFields.has(k)) radarrCardFields.delete(k);
			else radarrCardFields.add(k);
			radarrCardFields = radarrCardFields;
			if (browser)
				localStorage.setItem(RADARR_CARD_STORAGE_KEY, JSON.stringify([...radarrCardFields]));
		} else {
			const k = key as SonarrCardField;
			if (sonarrCardFields.has(k)) sonarrCardFields.delete(k);
			else sonarrCardFields.add(k);
			sonarrCardFields = sonarrCardFields;
			if (browser)
				localStorage.setItem(SONARR_CARD_STORAGE_KEY, JSON.stringify([...sonarrCardFields]));
		}
	}

	$: activeCardFields = isRadarr ? RADARR_CARD_FIELDS : SONARR_CARD_FIELDS;
	$: activeCardFieldLabels = isRadarr ? radarrCardFieldLabels : sonarrCardFieldLabels;
	$: activeVisibleCardFields = isRadarr
		? new Set([...radarrCardFields])
		: new Set([...sonarrCardFields]);

	// ==========================================================================
	// Radarr Data & Columns
	// ==========================================================================

	$: baseUrl = data.instance.url.replace(/\/$/, '');

	$: radarrLibrary = library as RadarrLibraryItem[];
	$: allMoviesWithFiles = isRadarr ? radarrLibrary.filter((m) => m.hasFile) : [];
	$: moviesWithFiles = (() => {
		let result = applySmartFilters(allMoviesWithFiles, filterTags, radarrFields);
		if (mobileQuery) {
			const q = mobileQuery.toLowerCase();
			result = result.filter((m) => m.title.toLowerCase().includes(q));
		}
		return result;
	})();

	// ==========================================================================
	// Sonarr Data
	// ==========================================================================

	$: sonarrLibrary = library as SonarrLibraryItem[];
	$: filteredSeries = (() => {
		if (!isSonarr) return [];
		let result = applySmartFilters(sonarrLibrary, filterTags, sonarrFields);
		if (mobileQuery) {
			const q = mobileQuery.toLowerCase();
			result = result.filter((s) => s.title.toLowerCase().includes(q));
		}
		return result;
	})();

	let sonarrTableView: SonarrTableView;

	// ==========================================================================
	// Card Sort
	// ==========================================================================

	let cardSortKey = 'title';
	let cardSortDirection: 'asc' | 'desc' = 'asc';

	function handleCardSort(key: string, direction: 'asc' | 'desc') {
		cardSortKey = key;
		cardSortDirection = direction;
	}

	function sortItems<T>(items: T[], key: string, direction: 'asc' | 'desc'): T[] {
		return [...items].sort((a: any, b: any) => {
			let aVal: any;
			let bVal: any;

			switch (key) {
				case 'title':
					aVal = sortTitle(a.title);
					bVal = sortTitle(b.title);
					break;
				case 'size':
					aVal = a.sizeOnDisk ?? 0;
					bVal = b.sizeOnDisk ?? 0;
					break;
				case 'dateAdded':
					aVal = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
					bVal = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
					break;
				case 'year':
					aVal = a.year ?? 0;
					bVal = b.year ?? 0;
					break;
				case 'score':
					aVal = a.customFormatScore ?? a.percentOfEpisodes ?? 0;
					bVal = b.customFormatScore ?? b.percentOfEpisodes ?? 0;
					break;
				default:
					return 0;
			}

			if (aVal < bVal) return direction === 'asc' ? -1 : 1;
			if (aVal > bVal) return direction === 'asc' ? 1 : -1;
			return 0;
		});
	}

	$: sortedMovies = sortItems(moviesWithFiles, cardSortKey, cardSortDirection);
	$: sortedSeries = sortItems(filteredSeries, cardSortKey, cardSortDirection);

	// ==========================================================================
	// Card View Progressive Loading
	// ==========================================================================

	const {
		visibleCount: cardVisibleCount,
		sentinel: cardSentinel,
		reset: cardReset,
		setTotalCount: cardSetTotalCount
	} = createProgressiveList({ pageSize: 60 });

	$: if (isRadarr) {
		cardSetTotalCount(sortedMovies.length);
	} else if (isSonarr) {
		cardSetTotalCount(sortedSeries.length);
	}

	// Reset progressive list when data changes
	$: (sortedMovies, sortedSeries, cardReset());

	$: visibleMovieCards = sortedMovies.slice(0, $cardVisibleCount);
	$: visibleSeriesCards = sortedSeries.slice(0, $cardVisibleCount);
</script>

<svelte:head>
	<title>{data.instance.name} - Library - Profilarr</title>
</svelte:head>

<div class="mt-6 space-y-6">
	{#if libraryError && !loading}
		<div
			class="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/40"
		>
			<div class="flex items-center gap-3">
				<AlertTriangle class="h-5 w-5 text-red-600 dark:text-red-400" />
				<div>
					<h3 class="font-medium text-red-800 dark:text-red-200">Failed to load library</h3>
					<p class="mt-1 text-sm text-red-600 dark:text-red-400">{libraryError}</p>
				</div>
			</div>
		</div>
	{:else if !isSupported}
		<div
			class="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
		>
			<div class="flex items-center gap-3">
				<Film class="h-5 w-5 text-neutral-400" />
				<div>
					<h3 class="font-medium text-neutral-900 dark:text-neutral-50">
						Library view not yet available
					</h3>
					<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
						Library view is currently only supported for Radarr and Sonarr instances.
					</p>
				</div>
			</div>
		</div>
	{:else}
		<LibraryActionBar
			fields={activeFields}
			items={isRadarr ? allMoviesWithFiles : sonarrLibrary}
			bind:tags={filterTags}
			filterStorageKey={`smartFilter:${data.instance.id}`}
			searchStore={mobileSearchStore}
			visibleColumns={activeVisibleColumns}
			toggleableColumns={activeToggleableColumns}
			columnLabels={activeColumnLabels}
			cacheAgeText={loading ? null : cacheAgeText}
			{refreshing}
			onToggleColumn={toggleColumn}
			onRefresh={handleRefresh}
			onOpen={handleOpen}
			instanceType={data.instance.type}
			bind:viewMode
			{expandAll}
			onToggleExpandAll={toggleExpandAll}
			sortKey={cardSortKey}
			sortDirection={cardSortDirection}
			onSort={handleCardSort}
			visibleCardFields={activeVisibleCardFields}
			toggleableCardFields={activeCardFields}
			cardFieldLabels={activeCardFieldLabels}
			onToggleCardField={toggleCardField}
			onFilterInfo={() => (showFilterInfo = true)}
		/>

		{#if viewMode === 'table'}
			{#if isRadarr}
				{#if allMoviesWithFiles.length === 0 && !loading && !refreshing}
					<div
						class="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
					>
						<div class="flex items-center gap-3">
							<Film class="h-5 w-5 text-neutral-400" />
							<div>
								<h3 class="font-medium text-neutral-900 dark:text-neutral-50">
									No movies with files
								</h3>
								<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
									This library has {library.length} movies but none have downloaded files yet.
								</p>
							</div>
						</div>
					</div>
				{:else}
					<RadarrTableView
						data={moviesWithFiles}
						loading={loading || refreshing}
						{baseUrl}
						{expandAll}
						visibleColumns={activeVisibleColumns}
						emptyMessage={filterTags.length > 0
							? 'No movies match the current filters'
							: 'No movies with files'}
					/>
				{/if}
			{:else if isSonarr}
				{#if sonarrLibrary.length === 0 && !loading && !refreshing}
					<div
						class="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
					>
						<div class="flex items-center gap-3">
							<Film class="h-5 w-5 text-neutral-400" />
							<div>
								<h3 class="font-medium text-neutral-900 dark:text-neutral-50">No series found</h3>
								<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
									This Sonarr instance has no series in its library.
								</p>
							</div>
						</div>
					</div>
				{:else}
					<SonarrTableView
						bind:this={sonarrTableView}
						data={filteredSeries}
						loading={loading || refreshing}
						{baseUrl}
						{expandAll}
						instanceId={data.instance.id}
						visibleColumns={activeVisibleColumns}
						emptyMessage={filterTags.length > 0
							? 'No series match the current filters'
							: 'No series found'}
					/>
				{/if}
			{/if}
		{:else}
			<!-- ============================================================ -->
			<!-- Card View -->
			<!-- ============================================================ -->
			{#if loading || refreshing}
				<LibraryCardGrid columns={6}>
					{#each Array(15) as _}
						<div
							class="animate-pulse overflow-hidden rounded-xl border border-neutral-300 bg-neutral-50 dark:border-neutral-700/60 dark:bg-neutral-900"
						>
							<div class="aspect-[2/3] w-full bg-neutral-200 dark:bg-neutral-800"></div>
							<div class="space-y-2 p-3">
								<div class="h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-700"></div>
								<div class="h-3 w-1/4 rounded bg-neutral-200 dark:bg-neutral-700"></div>
								<div class="h-5 w-1/2 rounded bg-neutral-200 dark:bg-neutral-700"></div>
							</div>
						</div>
					{/each}
				</LibraryCardGrid>
			{:else if isRadarr}
				{#if moviesWithFiles.length === 0}
					<div
						class="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
					>
						<p class="text-sm text-neutral-500 dark:text-neutral-400">
							{filterTags.length > 0
								? 'No movies match the current filters'
								: 'No movies with files'}
						</p>
					</div>
				{:else}
					<LibraryCardGrid columns={6}>
						{#each visibleMovieCards as movie (movie.id)}
							<MovieCard {movie} {baseUrl} visibleFields={activeVisibleCardFields} />
						{/each}
					</LibraryCardGrid>
					<div use:cardSentinel></div>
				{/if}
			{:else if isSonarr}
				{#if filteredSeries.length === 0}
					<div
						class="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
					>
						<p class="text-sm text-neutral-500 dark:text-neutral-400">
							{filterTags.length > 0 ? 'No series match the current filters' : 'No series found'}
						</p>
					</div>
				{:else}
					<LibraryCardGrid columns={6}>
						{#each visibleSeriesCards as series (series.id)}
							<SeriesCard
								{series}
								{baseUrl}
								instanceId={data.instance.id}
								visibleFields={activeVisibleCardFields}
							/>
						{/each}
					</LibraryCardGrid>
					<div use:cardSentinel></div>
				{/if}
			{/if}
		{/if}
	{/if}
</div>

<InfoModal bind:open={showFilterInfo} header="How Filters Work">
	<div class="space-y-4 text-sm text-neutral-600 dark:text-neutral-400">
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Quick Search</div>
			<p class="mt-1">
				Start typing and press Enter to search by title. No need to select a field first.
			</p>
		</div>
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Field Filters</div>
			<p class="mt-1">
				Click the input to see all available fields. Select one, then type or pick a value to create
				a filter.
			</p>
		</div>
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Number Filters</div>
			<p class="mt-1">
				For numeric fields like Score or Year, use operators such as &gt;1000, &lt;500, &gt;=200, or
				ranges like 2020-2025.
			</p>
		</div>
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Negation</div>
			<p class="mt-1">
				Click any filter tag to toggle it to NOT mode. Negated filters exclude matching items
				instead of including them.
			</p>
		</div>
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Combining Filters</div>
			<p class="mt-1">
				Multiple filters use AND logic. All must match. Press Backspace on an empty input to remove
				the last filter, or click the X on any tag.
			</p>
		</div>
	</div>
</InfoModal>
