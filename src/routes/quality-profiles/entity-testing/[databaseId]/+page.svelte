<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { Info, Clapperboard, Film, Tv, Plus, AlertTriangle, Sliders, Check } from 'lucide-svelte';
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import AddEntityModal from './components/AddEntityModal.svelte';
	import ReleaseModal from './components/ReleaseModal.svelte';
	import ImportReleasesModal from './components/ImportReleasesModal.svelte';
	import EntityTable from './components/EntityTable.svelte';
	import { createDataPageStore } from '$lib/client/stores/dataPage';
	import { alertStore } from '$lib/client/alerts/store';
	import type { PageData } from './$types';
	import type { TestEntity, TestRelease } from '$shared/pcd/display.ts';
	import type { components } from '$api/v1.d.ts';

	type EvaluateResponse = components['schemas']['EvaluateResponse'];
	type ReleaseEvaluation = components['schemas']['ReleaseEvaluation'];
	type MediaType = components['schemas']['MediaType'];

	export let data: PageData;

	// Local state for evaluations (fetched lazily on expand)
	// Keyed by releaseId for quick lookup
	let evaluations: Record<number, ReleaseEvaluation> = {};
	let loadingEntityIds = new Set<number>();
	let fetchedEntityIds = new Set<number>();
	let expandedRows = new Set<number>();

	// Reset state when database changes
	$: if (data.currentDatabase) {
		evaluations = {};
		loadingEntityIds = new Set();
		fetchedEntityIds = new Set();
		expandedRows = new Set();
	}
	const readOnlyMessage = 'Entity tests are read-only for this database.';

	function notifyReadOnly() {
		alertStore.add('info', readOnlyMessage);
	}

	// Show warning if parser is unavailable
	onMount(() => {
		if (!data.parserAvailable) {
			alertStore.add('warning', 'Parser service unavailable. Release scoring disabled.', 0);
		}

		// Restore selected profile from localStorage
		const stored = localStorage.getItem('entityTesting.selectedProfileId');
		if (stored) {
			const id = parseInt(stored, 10);
			// Verify profile exists in current database
			if (data.qualityProfiles.some((p) => p.id === id)) {
				selectedProfileId = id;
			}
		}
	});

	// Persist selected profile to localStorage
	function setSelectedProfile(id: number | null) {
		selectedProfileId = id;
		if (id !== null) {
			localStorage.setItem('entityTesting.selectedProfileId', String(id));
		} else {
			localStorage.removeItem('entityTesting.selectedProfileId');
		}
	}

	// Quality profile selection
	let selectedProfileId: number | null = null;

	// Fetch evaluations for an entity's releases
	async function fetchEvaluations(entity: TestEntity) {
		if (fetchedEntityIds.has(entity.id) || loadingEntityIds.has(entity.id)) {
			return; // Already fetched or in progress
		}

		if (entity.releases.length === 0) {
			fetchedEntityIds.add(entity.id);
			fetchedEntityIds = fetchedEntityIds;
			return;
		}

		loadingEntityIds.add(entity.id);
		loadingEntityIds = loadingEntityIds;

		try {
			const response = await fetch('/api/v1/entity-testing/evaluate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					databaseId: data.currentDatabase.id,
					releases: entity.releases.map((r) => ({
						id: r.id,
						title: r.title,
						type: entity.type,
						languages: r.languages.length > 0 ? r.languages : undefined
					}))
				})
			});

			if (!response.ok) {
				throw new Error('Failed to fetch evaluations');
			}

			const result: EvaluateResponse = await response.json();

			// Merge evaluations into local state
			for (const evaluation of result.evaluations) {
				evaluations[evaluation.releaseId] = evaluation;
			}
			evaluations = evaluations; // Trigger reactivity

			fetchedEntityIds.add(entity.id);
			fetchedEntityIds = fetchedEntityIds;
		} catch (err) {
			console.error('Failed to fetch evaluations:', err);
			alertStore.add('error', 'Failed to evaluate releases');
		} finally {
			loadingEntityIds.delete(entity.id);
			loadingEntityIds = loadingEntityIds;
		}
	}

	// Handle entity expansion
	function handleExpand(e: CustomEvent<{ entity: TestEntity }>) {
		fetchEvaluations(e.detail.entity);
	}

	// Calculate score for a release based on selected profile
	// Reactive so it updates when selectedProfileId changes
	$: calculateScore = (releaseId: number, entityType: 'movie' | 'series'): number | null => {
		if (!selectedProfileId) return null;

		const evaluation = evaluations[releaseId];
		if (!evaluation || !evaluation.cfMatches) return null;

		// Get the profile name from the selected ID
		const profile = data.qualityProfiles.find((p) => p.id === selectedProfileId);
		if (!profile) return null;

		const profileScores = data.cfScoresData.profiles.find((p) => p.profileName === profile.name);
		if (!profileScores) return null;

		const arrType = entityType === 'movie' ? 'radarr' : 'sonarr';
		let totalScore = 0;

		for (const [cfName, matches] of Object.entries(evaluation.cfMatches)) {
			if (!matches) continue;

			const cfScore = profileScores.scores[cfName];
			if (cfScore) {
				const score = cfScore[arrType];
				if (score !== null) {
					totalScore += score;
				}
			}
		}

		return totalScore;
	};
	$: selectedProfile = selectedProfileId
		? data.qualityProfiles.find((p) => p.id === selectedProfileId)
		: null;

	// Modal state
	let showInfoModal = false;
	let showAddModal = false;

	// Entity delete modal state
	let showDeleteModal = false;
	let entityToDelete: TestEntity | null = null;
	let deleteFormRef: HTMLFormElement | null = null;

	// Release modal state
	let showReleaseModal = false;
	let releaseModalMode: 'create' | 'edit' = 'create';
	let releaseEntityType: 'movie' | 'series' = 'movie';
	let releaseEntityTmdbId: number = 0;
	let currentRelease: TestRelease | null = null;

	// Release delete modal state
	let showDeleteReleaseModal = false;
	let releaseToDelete: TestRelease | null = null;
	let deleteReleaseFormRef: HTMLFormElement | null = null;

	// Import releases modal state
	let showImportModal = false;
	let importEntity: TestEntity | null = null;

	// Layer selection for delete operations
	let deleteLayer: 'user' | 'base' = data.canWriteToBase ? 'base' : 'user';
	let deleteReleaseLayer: 'user' | 'base' = data.canWriteToBase ? 'base' : 'user';

	// Entity type selection (both selected by default)
	let moviesSelected = true;
	let seriesSelected = true;

	// Prevent unchecking if it's the only one selected
	function toggleMovies() {
		if (moviesSelected && !seriesSelected) return;
		moviesSelected = !moviesSelected;
	}

	function toggleSeries() {
		if (seriesSelected && !moviesSelected) return;
		seriesSelected = !seriesSelected;
	}

	// Dynamic search placeholder based on selection
	$: searchPlaceholder = (() => {
		if (moviesSelected && seriesSelected) return 'Search movies, TV series...';
		if (moviesSelected) return 'Search movies...';
		if (seriesSelected) return 'Search TV series...';
		return 'Search...';
	})();

	// Initialize data page store
	const { search, filtered, setItems } = createDataPageStore(data.testEntities, {
		storageKey: 'entityTestingView',
		searchKeys: ['title'],
		searchKey: `entityTestingSearch:${data.currentDatabase.id}`
	});

	// Update items when data changes (e.g., switching databases)
	$: setItems(data.testEntities);

	// Filter by type selection
	$: typeFilteredEntities = ($filtered as TestEntity[]).filter((entity) => {
		if (moviesSelected && seriesSelected) return true;
		if (moviesSelected) return entity.type === 'movie';
		if (seriesSelected) return entity.type === 'series';
		return true;
	});

	// Map databases to tabs
	$: tabs = data.databases.map((db) => ({
		label: db.name,
		href: `/quality-profiles/entity-testing/${db.id}`,
		active: db.id === data.currentDatabase.id
	}));

	// Entity delete handlers
	function handleConfirmDelete(e: CustomEvent<{ entity: TestEntity; formRef: HTMLFormElement }>) {
		if (!data.canWriteToBase) {
			notifyReadOnly();
			return;
		}
		entityToDelete = e.detail.entity;
		deleteFormRef = e.detail.formRef;
		showDeleteModal = true;
	}

	async function handleDeleteConfirm() {
		showDeleteModal = false;
		deleteLayer = data.canWriteToBase ? 'base' : 'user';
		await tick();
		if (deleteFormRef) {
			deleteFormRef.requestSubmit();
		}
		entityToDelete = null;
		deleteFormRef = null;
	}

	function handleDeleteCancel() {
		showDeleteModal = false;
		entityToDelete = null;
		deleteFormRef = null;
	}

	// Release modal handlers
	function handleAddRelease(
		e: CustomEvent<{ entityType: 'movie' | 'series'; entityTmdbId: number }>
	) {
		if (!data.canWriteToBase) {
			notifyReadOnly();
			return;
		}
		releaseEntityType = e.detail.entityType;
		releaseEntityTmdbId = e.detail.entityTmdbId;
		releaseModalMode = 'create';
		currentRelease = null;
		showReleaseModal = true;
	}

	function handleEditRelease(
		e: CustomEvent<{ entityType: 'movie' | 'series'; entityTmdbId: number; release: TestRelease }>
	) {
		if (!data.canWriteToBase) {
			notifyReadOnly();
			return;
		}
		releaseEntityType = e.detail.entityType;
		releaseEntityTmdbId = e.detail.entityTmdbId;
		releaseModalMode = 'edit';
		currentRelease = e.detail.release;
		showReleaseModal = true;
	}

	// Release delete handlers
	function handleConfirmDeleteRelease(
		e: CustomEvent<{ release: TestRelease; formRef: HTMLFormElement }>
	) {
		if (!data.canWriteToBase) {
			notifyReadOnly();
			return;
		}
		releaseToDelete = e.detail.release;
		deleteReleaseFormRef = e.detail.formRef;
		showDeleteReleaseModal = true;
	}

	async function handleDeleteReleaseConfirm() {
		showDeleteReleaseModal = false;
		deleteReleaseLayer = data.canWriteToBase ? 'base' : 'user';
		await tick();
		if (deleteReleaseFormRef) {
			deleteReleaseFormRef.requestSubmit();
		}
		releaseToDelete = null;
		deleteReleaseFormRef = null;
	}

	function handleDeleteReleaseCancel() {
		showDeleteReleaseModal = false;
		releaseToDelete = null;
		deleteReleaseFormRef = null;
	}

	// Import releases handler
	function handleImportReleases(e: CustomEvent<{ entity: TestEntity }>) {
		if (!data.canWriteToBase) {
			notifyReadOnly();
			return;
		}
		importEntity = e.detail.entity;
		showImportModal = true;
	}
</script>

<svelte:head>
	<title>Entity Testing - {data.currentDatabase?.name} - Profilarr</title>
</svelte:head>

<div class="space-y-6 px-4 pt-4 pb-8 md:px-8">
	<!-- Database Tabs -->
	<Tabs {tabs} responsive />

	<!-- Actions Bar -->
	<ActionsBar className="w-full justify-center md:w-full md:mx-auto">
		<SearchAction searchStore={search} placeholder={searchPlaceholder} responsive />
		<ActionButton
			icon={Plus}
			on:click={() => (data.canWriteToBase ? (showAddModal = true) : notifyReadOnly())}
		/>
		<ActionButton
			icon={Sliders}
			hasDropdown={true}
			dropdownPosition="right"
			square={!selectedProfile}
		>
			{#if selectedProfile}
				<span class="ml-2 text-sm text-neutral-700 dark:text-neutral-300"
					>{selectedProfile.name}</span
				>
			{/if}
			<Dropdown slot="dropdown" position="right">
				<DropdownItem
					label="No Profile"
					selected={selectedProfileId === null}
					on:click={() => setSelectedProfile(null)}
				/>
				{#each data.qualityProfiles as profile}
					<DropdownItem
						label={profile.name}
						selected={selectedProfileId === profile.id}
						on:click={() => setSelectedProfile(profile.id)}
					/>
				{/each}
			</Dropdown>
		</ActionButton>
		<ActionButton icon={Clapperboard} hasDropdown={true} dropdownPosition="right">
			<Dropdown slot="dropdown" position="right">
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
		</ActionButton>
		<ActionButton icon={Info} on:click={() => (showInfoModal = true)} />
	</ActionsBar>

	<!-- Entity Testing Content -->
	<div class="mt-6">
		{#if data.testEntities.length === 0}
			<div
				class="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900"
			>
				{#if !data.tmdbConfigured}
					<div class="flex flex-col items-center gap-2">
						<AlertTriangle size={24} class="text-amber-500" />
						<p class="text-neutral-600 dark:text-neutral-400">
							TMDB API key not configured. <a
								href="/settings/general"
								class="text-accent-600 hover:underline dark:text-accent-400"
								>Configure in Settings</a
							>
						</p>
					</div>
				{:else}
					<p class="text-neutral-600 dark:text-neutral-400">
						No entity tests found for {data.currentDatabase?.name}
					</p>
				{/if}
			</div>
		{:else}
			<EntityTable
				entities={typeFilteredEntities}
				{evaluations}
				{loadingEntityIds}
				{selectedProfileId}
				qualityProfiles={data.qualityProfiles}
				cfScoresData={data.cfScoresData}
				{calculateScore}
				{deleteLayer}
				{deleteReleaseLayer}
				bind:expandedRows
				on:expand={handleExpand}
				on:confirmDelete={handleConfirmDelete}
				on:addRelease={handleAddRelease}
				on:importReleases={handleImportReleases}
				on:editRelease={handleEditRelease}
				on:confirmDeleteRelease={handleConfirmDeleteRelease}
			/>
		{/if}
	</div>
</div>

<InfoModal bind:open={showInfoModal} header="How Entity Testing Works">
	<div class="space-y-4 text-sm text-neutral-600 dark:text-neutral-400">
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Adding Entities</div>
			<p class="mt-1">
				Add movies or TV series from TMDB to use as test cases. These represent the media you want
				to simulate release matching for.
			</p>
		</div>
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Test Releases</div>
			<p class="mt-1">
				For each entity, add test releases with realistic release titles (e.g.,
				"Movie.2024.1080p.BluRay.REMUX-GROUP"). You can also specify size, languages, indexers, and
				flags.
			</p>
		</div>
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Quality Profile Scoring</div>
			<p class="mt-1">
				Select a quality profile from the dropdown to see how each release would score. The score is
				calculated by matching custom formats and summing their configured point values.
			</p>
		</div>
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Custom Format Matching</div>
			<p class="mt-1">
				Expand a release row to see parsed metadata and which custom formats matched. Each matched
				format shows its score contribution, helping you understand why a release scored the way it
				did.
			</p>
		</div>
	</div>
</InfoModal>

<AddEntityModal
	bind:open={showAddModal}
	existingEntities={data.testEntities}
	canWriteToBase={data.canWriteToBase}
	tmdbConfigured={data.tmdbConfigured}
/>

<Modal
	bind:open={showDeleteModal}
	header="Delete Entity"
	bodyMessage="Are you sure you want to delete {entityToDelete?.title}? This will also remove all associated test releases."
	confirmText="Delete"
	confirmDanger={true}
	size="sm"
	on:confirm={handleDeleteConfirm}
	on:cancel={handleDeleteCancel}
/>

<ReleaseModal
	bind:open={showReleaseModal}
	mode={releaseModalMode}
	entityType={releaseEntityType}
	entityTmdbId={releaseEntityTmdbId}
	release={currentRelease}
	canWriteToBase={data.canWriteToBase}
/>

<Modal
	bind:open={showDeleteReleaseModal}
	header="Delete Release"
	bodyMessage="Are you sure you want to delete this test release?"
	confirmText="Delete"
	confirmDanger={true}
	size="sm"
	on:confirm={handleDeleteReleaseConfirm}
	on:cancel={handleDeleteReleaseCancel}
/>

<ImportReleasesModal
	bind:open={showImportModal}
	entity={importEntity}
	arrInstances={data.arrInstances}
	canWriteToBase={data.canWriteToBase}
/>
