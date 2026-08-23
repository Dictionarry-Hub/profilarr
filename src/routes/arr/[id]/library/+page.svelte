<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { AlertTriangle, Film } from '@lucide/svelte';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import type { RadarrLibraryItem, SonarrSeriesItem } from '$utils/arr/types.ts';
	import { compareOptionalDates, sortTitle } from '$shared/utils/sort.ts';
	import { getPersistentSearchStore } from '$stores/search';
	import type { FilterFieldDef, FilterTag } from '$ui/filter/types';
	import { applySmartFilters } from '$ui/filter/match';
	import { createViewModeStore } from '$lib/client/stores/dataPage';
	import {
		createLibraryCardFieldsPref,
		createLibraryColumnsPref,
		createLibraryDownloadStatusesPref,
		createLibraryExpandAllPref,
		createLibrarySortPref,
		toggleSetPref
	} from '$stores/libraryPrefs';
	import {
		RADARR_CARD_FIELDS,
		RADARR_RELEASE_DATE_KEYS,
		RADARR_TOGGLEABLE_COLUMNS,
		SONARR_CARD_FIELDS,
		SONARR_TOGGLEABLE_COLUMNS,
		type LibraryDownloadStatus,
		type RadarrCardField,
		type RadarrToggleableColumn,
		type SonarrCardField,
		type SonarrToggleableColumn
	} from '$shared/utils/libraryPrefs';
	import { createProgressiveList } from '$lib/client/utils/progressiveList';
	import { getDisplayUrl } from '$lib/client/utils/arrDisplayUrl.ts';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';

	import LibraryActionBar from './components/LibraryActionBar.svelte';
	import RadarrTableView from './components/RadarrTableView.svelte';
	import SonarrTableView from './components/SonarrTableView.svelte';
	import LibraryCardGrid from './components/LibraryCardGrid.svelte';
	import MovieCard from './components/MovieCard.svelte';
	import SeriesCard from './components/SeriesCard.svelte';

	export let data: PageData;

	$: instanceId = data.instance.id;
	$: instanceType = data.instance.type;
	$: isRadarr = instanceType === 'radarr';
	$: isSonarr = instanceType === 'sonarr';
	$: isSupported = isRadarr || isSonarr;

	// ==========================================================================
	// Smart Filter
	// ==========================================================================

	let filterTags: FilterTag[] = [];
	let showFilterInfo = false;

	// Simple search (used on mobile and when filterMode is 'simple')
	$: simpleSearchStore = getPersistentSearchStore(`arrLibrarySearch:${data.instance.id}`, {
		debounceMs: 150
	});
	$: simpleQuery = $simpleSearchStore.query;

	// useSimpleMode is bound from LibraryActionBar, which derives it from isMobile + filterMode
	let useSimpleMode = false;

	$: movieDownloadStatusesPref = createLibraryDownloadStatusesPref(instanceId);

	function handleMovieDownloadStatusToggle(status: LibraryDownloadStatus) {
		toggleSetPref(movieDownloadStatusesPref, status);
	}

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
			key: 'releaseGroup',
			label: 'Release Group',
			type: 'text',
			accessor: (m) => m.releaseGroup ?? '',
			suggestions: (items) =>
				[...new Set(items.map((m) => m.releaseGroup).filter(Boolean) as string[])].sort()
		},
		{
			key: 'profile',
			label: 'Profile',
			type: 'text',
			accessor: (m) => m.qualityProfileName,
			suggestions: (items) => [...new Set(items.map((m) => m.qualityProfileName))].sort()
		},
		{
			key: 'profileManagedBy',
			label: 'Profile Managed By',
			type: 'text',
			accessor: (m) => (m.isProfilarrProfile ? 'Profilarr' : 'External'),
			suggestions: () => ['Profilarr', 'External']
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

	const sonarrFields: FilterFieldDef<SonarrSeriesItem>[] = [
		{
			key: 'title',
			label: 'Title',
			type: 'text',
			accessor: (s) => s.title,
			isDefault: true,
			suggestions: (items) => items.map((s) => s.title).sort()
		},
		{
			key: 'releaseGroup',
			label: 'Release Group(s)',
			type: 'text',
			accessor: (s) => s.releaseGroups ?? [],
			suggestions: (items) => [...new Set(items.flatMap((s) => s.releaseGroups ?? []))].sort()
		},
		{
			key: 'profile',
			label: 'Profile',
			type: 'text',
			accessor: (s) => s.qualityProfileName,
			suggestions: (items) => [...new Set(items.map((s) => s.qualityProfileName))].sort()
		},
		{
			key: 'profileManagedBy',
			label: 'Profile Managed By',
			type: 'text',
			accessor: (s) => (s.isProfilarrProfile ? 'Profilarr' : 'External'),
			suggestions: () => ['Profilarr', 'External']
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

	const viewMode = createViewModeStore({ storageKey: 'profilarr-library-view' });

	// ==========================================================================
	// Expand All
	// ==========================================================================

	const expandAllPref = createLibraryExpandAllPref();

	function toggleExpandAll() {
		expandAllPref.update((value) => !value);
	}

	// ==========================================================================
	// Library Data State
	// ==========================================================================

	let library: RadarrLibraryItem[] | SonarrSeriesItem[] = [];
	let libraryError: string | null = null;
	let loading = true;
	let refreshing = false;
	let refreshedAt: string | null = null;
	let nextRefreshAt: string | null = null;

	let clockTick = Date.now();
	let clockInterval: ReturnType<typeof setInterval>;

	function formatElapsed(seconds: number): string {
		if (seconds < 60) return `${seconds}s ago`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		if (remainingMinutes === 0) return `${hours}h ago`;
		return `${hours}h ${remainingMinutes}m ago`;
	}

	function formatUntil(seconds: number): string {
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return `${hours}h ${remainingMinutes}m`;
	}

	function parseTimestamp(value: string | null): number | null {
		if (!value) return null;
		const timestamp = Date.parse(value);
		return Number.isFinite(timestamp) ? timestamp : null;
	}

	$: refreshStatusText = (() => {
		clockTick;
		const refreshedTimestamp = parseTimestamp(refreshedAt);
		if (refreshedTimestamp === null) return null;

		const elapsedSeconds = Math.max(0, Math.floor((Date.now() - refreshedTimestamp) / 1000));
		const parts = [formatElapsed(elapsedSeconds)];
		const nextRefreshTimestamp = parseTimestamp(nextRefreshAt);

		if (nextRefreshTimestamp === null) {
			parts.push('Automatic refresh off');
		} else {
			const secondsUntil = Math.ceil((nextRefreshTimestamp - Date.now()) / 1000);
			parts.push(secondsUntil > 0 ? `Next in ${formatUntil(secondsUntil)}` : 'Refresh due');
		}

		return parts.join(' · ');
	})();

	async function fetchLibrary(force = false) {
		const instanceId = data.instance.id;
		const resourcePath = isRadarr ? 'movies' : 'series';

		try {
			if (force) {
				const refreshResponse = await fetch(`/arr/${instanceId}/library/refresh`, {
					method: 'POST'
				});
				if (!refreshResponse.ok) {
					throw new Error(`Failed to refresh library: ${refreshResponse.statusText}`);
				}
			}

			const response = await fetch(`/arr/${instanceId}/library/${resourcePath}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch library: ${response.statusText}`);
			}

			const result = await response.json();
			library = result.items;
			refreshedAt = result.refreshedAt;
			nextRefreshAt = result.nextRefreshAt;
			libraryError = null;
		} catch (err) {
			libraryError = err instanceof Error ? err.message : 'Failed to fetch library';
		} finally {
			loading = false;
			refreshing = false;
		}
	}

	async function handleRefresh() {
		refreshing = true;
		if (isSonarr) {
			sonarrTableView?.resetEpisodeCache();
		}
		await fetchLibrary(true);
	}

	function handleOpen() {
		const baseUrl = getDisplayUrl(data.instance);
		window.open(baseUrl, '_blank', 'noopener,noreferrer');
	}

	let currentInstanceId: number | null = null;

	onMount(() => {
		currentInstanceId = data.instance.id;
		fetchLibrary();
		clockInterval = setInterval(() => {
			clockTick = Date.now();
		}, 1000);
	});

	onDestroy(() => {
		if (clockInterval) clearInterval(clockInterval);
	});

	// Refetch if instance changes (navigation between instances)
	$: if (browser && data.instance.id && data.instance.id !== currentInstanceId) {
		currentInstanceId = data.instance.id;
		loading = true;
		refreshedAt = null;
		nextRefreshAt = null;
		sonarrTableView?.resetEpisodeCache();
		fetchLibrary();
	}

	// ==========================================================================
	// Column Visibility (Radarr)
	// ==========================================================================

	const radarrColumnLabels: Record<RadarrToggleableColumn, string> = {
		qualityName: 'Quality',
		score: 'Score',
		releaseGroup: 'Release Group',
		sizeOnDisk: 'Size',
		status: 'Status',
		popularity: 'Popularity',
		dateAdded: 'Added',
		initialReleaseDate: 'Initial Release',
		theatricalReleaseDate: 'Theatrical Release',
		digitalReleaseDate: 'Digital Release',
		physicalReleaseDate: 'Physical Release'
	};

	// ==========================================================================
	// Column Visibility (Sonarr)
	// ==========================================================================

	const sonarrColumnLabels: Record<SonarrToggleableColumn, string> = {
		episodes: 'Episodes',
		sizeOnDisk: 'Size',
		releaseGroups: 'Release Group(s)',
		status: 'Status',
		dateAdded: 'Added',
		firstAired: 'Series Premiere',
		previousAiring: 'Latest Aired Episode'
	};

	// ==========================================================================
	// Unified column toggle (delegates based on type)
	// ==========================================================================

	$: columnsPref = createLibraryColumnsPref(instanceType);
	$: activeToggleableColumns = isRadarr ? RADARR_TOGGLEABLE_COLUMNS : SONARR_TOGGLEABLE_COLUMNS;
	$: activeColumnLabels = isRadarr ? radarrColumnLabels : sonarrColumnLabels;
	$: activeVisibleColumns = $columnsPref;

	function toggleColumn(key: string) {
		toggleSetPref(columnsPref, key);
	}

	// ==========================================================================
	// Card Field Visibility
	// ==========================================================================

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
		dateAdded: 'Date Added',
		initialReleaseDate: 'Initial Release',
		theatricalReleaseDate: 'Theatrical Release',
		digitalReleaseDate: 'Digital Release',
		physicalReleaseDate: 'Physical Release'
	};

	const sonarrCardFieldLabels: Record<SonarrCardField, string> = {
		monitored: 'Monitored',
		title: 'Title',
		profile: 'Profile',
		size: 'Size',
		episodes: 'Episodes',
		year: 'Year',
		releaseGroups: 'Release Group(s)',
		status: 'Status',
		rating: 'Rating',
		dateAdded: 'Date Added',
		firstAired: 'Series Premiere',
		previousAiring: 'Latest Aired Episode'
	};

	$: cardFieldsPref = createLibraryCardFieldsPref(instanceType);

	function toggleCardField(key: string) {
		toggleSetPref(cardFieldsPref, key);
	}

	$: activeCardFields = isRadarr ? RADARR_CARD_FIELDS : SONARR_CARD_FIELDS;
	$: activeCardFieldLabels = isRadarr ? radarrCardFieldLabels : sonarrCardFieldLabels;
	$: activeVisibleCardFields = $cardFieldsPref;

	// ==========================================================================
	// Radarr Data & Columns
	// ==========================================================================

	$: baseUrl = getDisplayUrl(data.instance);

	$: radarrLibrary = library as RadarrLibraryItem[];
	$: scopedMovies = isRadarr
		? radarrLibrary.filter((movie) => {
				const status: LibraryDownloadStatus = movie.hasFile ? 'downloaded' : 'missing';
				return $movieDownloadStatusesPref.has(status);
			})
		: [];
	$: filteredMovies = (() => {
		if (useSimpleMode) {
			if (!simpleQuery) return scopedMovies;
			const q = simpleQuery.toLowerCase();
			return scopedMovies.filter((m) => m.title.toLowerCase().includes(q));
		}
		return applySmartFilters(scopedMovies, filterTags, radarrFields);
	})();
	$: hasActiveMovieFilter = useSimpleMode ? simpleQuery.trim().length > 0 : filterTags.length > 0;
	$: movieEmptyMessage = hasActiveMovieFilter
		? 'No movies match the current filters'
		: $movieDownloadStatusesPref.size === 0
			? 'No download statuses selected'
			: $movieDownloadStatusesPref.size === 1 && $movieDownloadStatusesPref.has('downloaded')
				? 'No downloaded movies'
				: $movieDownloadStatusesPref.size === 1 && $movieDownloadStatusesPref.has('missing')
					? 'No missing movies'
					: 'No movies found';

	// ==========================================================================
	// Sonarr Data
	// ==========================================================================

	$: sonarrLibrary = library as SonarrSeriesItem[];
	$: filteredSeries = (() => {
		if (!isSonarr) return [];
		if (useSimpleMode) {
			if (!simpleQuery) return sonarrLibrary;
			const q = simpleQuery.toLowerCase();
			return sonarrLibrary.filter((s) => s.title.toLowerCase().includes(q));
		}
		return applySmartFilters(sonarrLibrary, filterTags, sonarrFields);
	})();

	// Values of any active (non-negated) release group filter, so the Sonarr views can
	// surface the group the user filtered on instead of the most common one.
	$: activeReleaseGroups = useSimpleMode
		? []
		: filterTags.filter((t) => t.field === 'releaseGroup' && !t.negated).map((t) => t.value);

	let sonarrTableView: SonarrTableView;

	// ==========================================================================
	// Card Sort
	// ==========================================================================

	$: sortPref = createLibrarySortPref(instanceId, instanceType);

	function handleCardSort(key: string, direction: 'asc' | 'desc') {
		sortPref.set({ key, direction });
	}

	function sortItems<T>(items: T[], key: string, direction: 'asc' | 'desc'): T[] {
		return [...items].sort((a: any, b: any) => {
			if (
				RADARR_RELEASE_DATE_KEYS.includes(key as (typeof RADARR_RELEASE_DATE_KEYS)[number]) ||
				key === 'firstAired' ||
				key === 'previousAiring'
			) {
				return compareOptionalDates(a[key], b[key], direction);
			}

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

	$: sortedMovies = sortItems(filteredMovies, $sortPref.key, $sortPref.direction);
	$: sortedSeries = sortItems(filteredSeries, $sortPref.key, $sortPref.direction);

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

<PageMeta title={`${data.instance.name} · Library`} />

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
			items={isRadarr ? scopedMovies : sonarrLibrary}
			bind:tags={filterTags}
			filterStorageKey={`smartFilter:${data.instance.id}`}
			searchStore={simpleSearchStore}
			bind:useSimpleMode
			visibleColumns={activeVisibleColumns}
			toggleableColumns={activeToggleableColumns}
			columnLabels={activeColumnLabels}
			refreshStatusText={loading ? null : refreshStatusText}
			{refreshing}
			onToggleColumn={toggleColumn}
			onRefresh={handleRefresh}
			onOpen={handleOpen}
			instanceType={data.instance.type}
			movieDownloadStatuses={$movieDownloadStatusesPref}
			onMovieDownloadStatusToggle={handleMovieDownloadStatusToggle}
			bind:viewMode={$viewMode}
			expandAll={$expandAllPref}
			onToggleExpandAll={toggleExpandAll}
			sortKey={$sortPref.key}
			sortDirection={$sortPref.direction}
			onSort={handleCardSort}
			visibleCardFields={activeVisibleCardFields}
			toggleableCardFields={activeCardFields}
			cardFieldLabels={activeCardFieldLabels}
			onToggleCardField={toggleCardField}
			onFilterInfo={() => (showFilterInfo = true)}
		/>

		{#if $viewMode === 'table'}
			{#if isRadarr}
				{#if radarrLibrary.length === 0 && !loading && !refreshing}
					<div
						class="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
					>
						<div class="flex items-center gap-3">
							<Film class="h-5 w-5 text-neutral-400" />
							<div>
								<h3 class="font-medium text-neutral-900 dark:text-neutral-50">No movies found</h3>
								<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
									This Radarr instance has no movies in its library.
								</p>
							</div>
						</div>
					</div>
				{:else}
					<RadarrTableView
						data={filteredMovies}
						loading={loading || refreshing}
						{baseUrl}
						expandAll={$expandAllPref}
						visibleColumns={activeVisibleColumns}
						emptyMessage={movieEmptyMessage}
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
						expandAll={$expandAllPref}
						instanceId={data.instance.id}
						visibleColumns={activeVisibleColumns}
						highlightGroups={activeReleaseGroups}
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
				{#if filteredMovies.length === 0}
					<div
						class="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
					>
						<p class="text-sm text-neutral-500 dark:text-neutral-400">{movieEmptyMessage}</p>
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
								highlightGroups={activeReleaseGroups}
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
