<script lang="ts">
	import FormInput from '$ui/form/FormInput.svelte';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import {
		Info,
		ArrowUpDown,
		ArrowUp,
		ArrowDown,
		Layers,
		LayoutGrid,
		Settings,
		User,
		X,
		Save,
		Plus,
		Loader2,
		Eye
	} from 'lucide-svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Button from '$ui/button/Button.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import CustomGroupManager from '$ui/dropdown/CustomGroupManager.svelte';
	import ScoringTable from './components/ScoringTable.svelte';
	import { getPersistentSearchStore, type SearchStore } from '$lib/client/stores/search';
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { current, isDirty, initEdit, update } from '$lib/client/stores/dirty';
	import { alertStore } from '$alerts/store';
	import SyncPromptModal from '$ui/modal/SyncPromptModal.svelte';
	import type { AffectedArr } from '$shared/sync/types.ts';
	import type { PageData } from './$types';

	export let data: PageData;

	$: databaseId = parseInt($page.params.databaseId ?? '0', 10);

	let showSyncModal = false;
	let pendingRedirectTo = '';
	let pendingAffectedArrs: AffectedArr[] = [];

	let searchStore: SearchStore;
	$: searchStore = getPersistentSearchStore(
		`qualityProfileScoringSearch:${$page.params.databaseId}:${$page.params.id}`,
		{ debounceMs: 200 }
	);

	let showInfoModal = false;
	let showOptionsInfoModal = false;

	// Scoring data shape
	interface ScoringFormData {
		minimumScore: number;
		upgradeUntilScore: number;
		upgradeScoreIncrement: number;
		customFormatScores: Record<string, Record<string, number | null>>;
		customFormatEnabled: Record<string, Record<string, boolean>>;
		[key: string]: unknown;
	}

	// Build initial data from server
	$: initialData = buildInitialData(data.scoring);

	function buildInitialData(scoring: typeof data.scoring): ScoringFormData {
		if (!scoring) {
			return {
				minimumScore: 0,
				upgradeUntilScore: 0,
				upgradeScoreIncrement: 1,
				customFormatScores: {},
				customFormatEnabled: {}
			};
		}

		const scores: Record<string, Record<string, number | null>> = {};
		const enabled: Record<string, Record<string, boolean>> = {};

		scoring.customFormats.forEach((cf: any) => {
			scores[cf.name] = { ...cf.scores };
			enabled[cf.name] = {};
			scoring.arrTypes.forEach((arrType: string) => {
				enabled[cf.name][arrType] = cf.scores[arrType] !== null;
			});
		});

		return {
			minimumScore: scoring.minimum_custom_format_score,
			upgradeUntilScore: scoring.upgrade_until_score,
			upgradeScoreIncrement: scoring.upgrade_score_increment,
			customFormatScores: scores,
			customFormatEnabled: enabled
		};
	}

	// Initialize dirty tracking
	$: initEdit(initialData);

	// Reactive getters for current values
	$: minimumScore = ($current.minimumScore ?? 0) as number;
	$: upgradeUntilScore = ($current.upgradeUntilScore ?? 0) as number;
	$: upgradeScoreIncrement = ($current.upgradeScoreIncrement ?? 1) as number;
	$: customFormatScores = ($current.customFormatScores ?? {}) as Record<
		string,
		Record<string, number | null>
	>;
	$: customFormatEnabled = ($current.customFormatEnabled ?? {}) as Record<
		string,
		Record<string, boolean>
	>;

	// Save state
	let isSaving = false;
	let saveError: string | null = null;
	let selectedLayer: 'user' | 'base' = data.canWriteToBase ? 'base' : 'user';
	let formElement: HTMLFormElement;

	type SortKey = 'name' | 'radarr' | 'sonarr';
	type SortDirection = 'asc' | 'desc';

	let sortState: { key: SortKey; direction: SortDirection } | null = null;

	// Tiling
	let tileColumns: number = 1;
	const TILING_STORAGE_KEY = 'scoring-tile-columns';

	// General options
	let hideUnscoredFormats: boolean = false;
	const HIDE_UNSCORED_STORAGE_KEY = 'scoring-hide-unscored';

	// Column visibility
	let hiddenArrTypes: Set<string> = new Set();

	// Grouping
	type GroupKey = string;
	let selectedGroups = new Set<GroupKey>();

	const GROUPING_STORAGE_KEY = 'scoring-selected-groups';
	const CUSTOM_GROUPS_STORAGE_KEY = 'scoring-custom-groups';

	// Define built-in groups with their tags (order matters - first match wins)
	const builtInGroups = [
		{ name: 'Audio', key: 'audio' as const, tags: ['audio'], custom: false },
		{ name: 'HDR', key: 'hdr' as const, tags: ['hdr'], custom: false },
		{
			name: 'Release Group',
			key: 'release-group' as const,
			tags: ['release group', 'release groups'],
			custom: false
		},
		{
			name: 'Release Group Tier',
			key: 'release-group-tier' as const,
			tags: ['release group tier', 'release group tiers'],
			custom: false
		},
		{
			name: 'Streaming Service',
			key: 'streaming-service' as const,
			tags: ['streaming service'],
			custom: false
		},
		{ name: 'Codec', key: 'codec' as const, tags: ['codec'], custom: false },
		{ name: 'Storage', key: 'storage' as const, tags: ['storage'], custom: false },
		{ name: 'Source', key: 'source' as const, tags: ['source'], custom: false },
		{
			name: 'Resolution',
			key: 'resolution' as const,
			tags: ['sd', '480p', '576p', '720p', '1080p', '2160p', '4k', '8k', 'resolution'],
			custom: false
		},
		{ name: 'Indexer Flag', key: 'indexer-flag' as const, tags: ['flag'], custom: false },
		{ name: 'Edition', key: 'edition' as const, tags: ['edition', 'colour grade'], custom: false },
		{
			name: 'Enhancement',
			key: 'enhancement' as const,
			tags: ['enhancement', 'enhancements'],
			custom: false
		},
		{
			name: 'Languages',
			key: 'languages' as const,
			tags: ['language', 'languages', 'asl'],
			custom: false
		}
	];

	// Custom groups from localStorage
	let customGroups: Array<{ name: string; key: string; tags: string[]; custom: boolean }> = [];

	// Combined groups
	$: groups = [...builtInGroups, ...customGroups];

	// Check if current config matches active profile - uncheck if different
	$: if (currentProfileId && !isLoadingProfile) {
		const activeProfile = profiles.find((p) => p.id === currentProfileId);
		if (activeProfile) {
			const searchQuery = $searchStore.query ?? '';
			const selectedGroupsArray = [...selectedGroups];
			const customGroupsClean = customGroups.map(({ name, key, tags }) => ({ name, key, tags }));

			// Compare all settings
			const configChanged =
				searchQuery !== activeProfile.searchQuery ||
				JSON.stringify(sortState) !== JSON.stringify(activeProfile.sortState) ||
				JSON.stringify(selectedGroupsArray) !== JSON.stringify(activeProfile.selectedGroups) ||
				JSON.stringify(customGroupsClean) !== JSON.stringify(activeProfile.customGroups) ||
				tileColumns !== activeProfile.tileColumns ||
				hideUnscoredFormats !== activeProfile.hideUnscoredFormats;

			if (configChanged) {
				currentProfileId = null;
			}
		}
	}

	// Profiles
	type Profile = {
		id: string;
		name: string;
		searchQuery: string;
		sortState: { key: SortKey; direction: SortDirection } | null;
		selectedGroups: GroupKey[];
		customGroups: Array<{ name: string; key: string; tags: string[] }>;
		tileColumns: number;
		hideUnscoredFormats: boolean;
	};
	let profiles: Profile[] = [];
	let currentProfileId: string | null = null;
	let newProfileName = '';
	let isLoadingProfile = false;
	const PROFILES_STORAGE_KEY = 'scoring-profiles';

	onMount(() => {
		// Load custom groups from localStorage
		const savedCustomGroups = localStorage.getItem(CUSTOM_GROUPS_STORAGE_KEY);
		if (savedCustomGroups) {
			try {
				const parsed = JSON.parse(savedCustomGroups);
				customGroups = parsed.map((g: any) => ({ ...g, custom: true }));
			} catch {
				customGroups = [];
			}
		}

		// Load grouping preference from localStorage
		const saved = localStorage.getItem(GROUPING_STORAGE_KEY);
		if (saved) {
			try {
				const parsed = JSON.parse(saved) as GroupKey[];
				selectedGroups = new Set(parsed.filter((key) => groups.some((g) => g.key === key)));
			} catch {
				selectedGroups = new Set();
			}
		}

		// Load tiling preference from localStorage
		const savedTiling = localStorage.getItem(TILING_STORAGE_KEY);
		if (savedTiling) {
			const parsed = parseInt(savedTiling, 10);
			if (!isNaN(parsed) && parsed >= 1 && parsed <= 3) {
				tileColumns = parsed;
			}
		}

		// Load hide unscored preference from localStorage
		const savedHideUnscored = localStorage.getItem(HIDE_UNSCORED_STORAGE_KEY);
		if (savedHideUnscored === 'true') {
			hideUnscoredFormats = true;
		}

		// Load profiles from localStorage
		const savedProfiles = localStorage.getItem(PROFILES_STORAGE_KEY);
		if (savedProfiles) {
			try {
				profiles = JSON.parse(savedProfiles);
			} catch {
				profiles = [];
			}
		}
	});

	function saveGroupingPreference() {
		localStorage.setItem(GROUPING_STORAGE_KEY, JSON.stringify([...selectedGroups]));
	}

	function toggleGroup(key: GroupKey) {
		if (selectedGroups.has(key)) {
			selectedGroups.delete(key);
		} else {
			selectedGroups.add(key);
		}
		selectedGroups = selectedGroups; // Trigger reactivity
		saveGroupingPreference();
	}

	function clearGrouping() {
		selectedGroups = new Set();
		saveGroupingPreference();
	}

	function setTileColumns(columns: number) {
		tileColumns = columns;
		localStorage.setItem(TILING_STORAGE_KEY, columns.toString());
	}

	function toggleHideUnscored() {
		hideUnscoredFormats = !hideUnscoredFormats;
		localStorage.setItem(HIDE_UNSCORED_STORAGE_KEY, hideUnscoredFormats.toString());
	}

	function toggleArrTypeVisibility(arrType: string) {
		if (hiddenArrTypes.has(arrType)) {
			hiddenArrTypes.delete(arrType);
		} else {
			hiddenArrTypes.add(arrType);
		}
		hiddenArrTypes = hiddenArrTypes;
	}

	function saveCustomGroups() {
		const toSave = customGroups.map(({ name, key, tags }) => ({ name, key, tags }));
		localStorage.setItem(CUSTOM_GROUPS_STORAGE_KEY, JSON.stringify(toSave));
	}

	function addCustomGroup(name: string, tags: string[]) {
		const key = `custom-${Date.now()}`;
		customGroups = [...customGroups, { name, key, tags, custom: true }];
		saveCustomGroups();
	}

	function deleteCustomGroup(key: string) {
		customGroups = customGroups.filter((g) => g.key !== key);
		// Remove from selected groups if it was selected
		selectedGroups.delete(key);
		selectedGroups = selectedGroups;
		saveCustomGroups();
		saveGroupingPreference();
	}

	// Profile management
	function saveProfile(name: string) {
		const id = `profile-${Date.now()}`;
		const profile: Profile = {
			id,
			name,
			searchQuery: $searchStore.query ?? '',
			sortState,
			selectedGroups: [...selectedGroups],
			customGroups: customGroups.map(({ name, key, tags }) => ({ name, key, tags })),
			tileColumns,
			hideUnscoredFormats
		};
		profiles = [...profiles, profile];
		localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
		currentProfileId = id;
	}

	function loadProfile(id: string) {
		const profile = profiles.find((p) => p.id === id);
		if (!profile) return;

		isLoadingProfile = true;

		// Apply profile settings
		searchStore.setQuery(profile.searchQuery);
		sortState = profile.sortState as { key: SortKey; direction: SortDirection } | null;
		selectedGroups = new Set(profile.selectedGroups);
		customGroups = profile.customGroups.map((g) => ({ ...g, custom: true }));
		tileColumns = profile.tileColumns;
		hideUnscoredFormats = profile.hideUnscoredFormats;

		// Save to individual storage keys
		saveGroupingPreference();
		saveCustomGroups();
		localStorage.setItem(TILING_STORAGE_KEY, tileColumns.toString());
		localStorage.setItem(HIDE_UNSCORED_STORAGE_KEY, hideUnscoredFormats.toString());

		currentProfileId = id;
		isLoadingProfile = false;
	}

	function deleteProfile(id: string) {
		profiles = profiles.filter((p) => p.id !== id);
		localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
		if (currentProfileId === id) {
			currentProfileId = null;
		}
	}

	function handleSaveProfile() {
		if (newProfileName.trim()) {
			saveProfile(newProfileName.trim());
			newProfileName = '';
		}
	}

	function loadDefaultProfile() {
		isLoadingProfile = true;

		// Apply default settings
		searchStore.setQuery('');
		sortState = { key: 'radarr', direction: 'desc' };
		selectedGroups = new Set();
		customGroups = [];
		tileColumns = 1;
		hideUnscoredFormats = false;

		// Save to individual storage keys
		saveGroupingPreference();
		saveCustomGroups();
		localStorage.setItem(TILING_STORAGE_KEY, tileColumns.toString());
		localStorage.setItem(HIDE_UNSCORED_STORAGE_KEY, hideUnscoredFormats.toString());

		currentProfileId = null;
		isLoadingProfile = false;
	}

	type IconCheckboxColor =
		| 'accent'
		| 'blue'
		| 'green'
		| 'red'
		| 'neutral'
		| `#${string}`
		| `var(--${string})`;

	// Arr type color mapping
	const arrTypeColors: Record<string, IconCheckboxColor> = {
		radarr: 'var(--arr-radarr-color)',
		sonarr: 'var(--arr-sonarr-color)'
	};

	function getArrTypeColor(arrType: string): IconCheckboxColor {
		return arrTypeColors[arrType] || '#3b82f6'; // default to blue
	}

	$: visibleArrTypes = scoring?.arrTypes.filter((t) => !hiddenArrTypes.has(t)) ?? [];

	$: scoring = data.scoring;
	// Compute filtered and sorted formats
	$: searchQuery = ($searchStore.query ?? '').trim().toLowerCase();
	$: filteredCustomFormats =
		scoring?.customFormats.filter((format) => {
			if (searchQuery && !format.name?.toLowerCase().includes(searchQuery)) {
				return false;
			}
			if (hideUnscoredFormats) {
				const hasAnyScore = scoring.arrTypes.some((arrType) => format.scores[arrType] !== null);
				if (!hasAnyScore) return false;
			}
			return true;
		}) || [];

	$: sortedCustomFormats = sortFormats(
		filteredCustomFormats,
		initialData.customFormatScores,
		sortState
	);
	$: groupedFormats = groupFormats(sortedCustomFormats, selectedGroups);

	// Apply default sort
	$: if (scoring && !sortState) {
		const defaultSortKey = (
			scoring.arrTypes.includes('radarr') ? 'radarr' : scoring.arrTypes[0]
		) as SortKey;
		if (defaultSortKey) {
			sortState = { key: defaultSortKey, direction: 'desc' };
		}
	}

	// Build custom format scores array for form submission
	function buildCustomFormatScoresArray(
		currentScores: Record<string, Record<string, number | null>>,
		initialScores: Record<string, Record<string, number | null>>
	): Array<{
		customFormatName: string;
		arrType: string;
		score: number | null;
	}> {
		const result: Array<{ customFormatName: string; arrType: string; score: number | null }> = [];

		for (const [cfName, arrTypeScores] of Object.entries(currentScores)) {
			const initialScoresForFormat = initialScores[cfName] || {};

			for (const [arrType, score] of Object.entries(arrTypeScores)) {
				// Only include if different from initial
				if (score !== initialScoresForFormat[arrType]) {
					result.push({ customFormatName: cfName, arrType, score });
				}
			}
		}

		return result;
	}

	$: customFormatScoresPayload = JSON.stringify(
		buildCustomFormatScoresArray(customFormatScores, initialData.customFormatScores)
	);

	// Handlers for score changes from ScoringTable
	function handleScoreChange(
		event: CustomEvent<{ formatName: string; arrType: string; score: number | null }>
	) {
		const { formatName, arrType, score } = event.detail;
		const newScores = { ...customFormatScores };
		if (!newScores[formatName]) newScores[formatName] = {};
		newScores[formatName][arrType] = score;
		update('customFormatScores', newScores);
	}

	function handleEnabledChange(
		event: CustomEvent<{ formatName: string; arrType: string; enabled: boolean }>
	) {
		const { formatName, arrType, enabled } = event.detail;
		const newEnabled = { ...customFormatEnabled };
		if (!newEnabled[formatName]) newEnabled[formatName] = {};
		newEnabled[formatName][arrType] = enabled;
		update('customFormatEnabled', newEnabled);
	}

	async function handleSaveClick() {
		selectedLayer = data.canWriteToBase ? 'base' : 'user';
		await tick();
		formElement?.requestSubmit();
	}

	function toggleSort(key: SortKey, defaultDirection: SortDirection = 'asc') {
		if (sortState?.key === key) {
			// Toggle direction
			sortState = { key, direction: sortState.direction === 'asc' ? 'desc' : 'asc' };
		} else {
			// New sort key
			sortState = { key, direction: defaultDirection };
		}
	}

	function sortFormats(
		formats: any[],
		scores: Record<string, Record<string, number | null>>,
		sortState: { key: SortKey; direction: SortDirection } | null
	) {
		if (!sortState) return formats;

		const sorted = [...formats].sort((a, b) => {
			let aVal: any;
			let bVal: any;

			if (sortState.key === 'name') {
				aVal = a.name?.toLowerCase() || '';
				bVal = b.name?.toLowerCase() || '';
				return sortState.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
			} else {
				// Sort by score (radarr or sonarr)
				aVal = scores[a.name]?.[sortState.key] ?? null;
				bVal = scores[b.name]?.[sortState.key] ?? null;

				// Handle nulls - always put them at the end
				if (aVal === null && bVal === null) return 0;
				if (aVal === null) return 1;
				if (bVal === null) return -1;

				return sortState.direction === 'desc' ? bVal - aVal : aVal - bVal;
			}
		});

		return sorted;
	}

	function groupFormats(formats: any[], selectedGroups: Set<GroupKey>) {
		// If no groups selected, show all formats in one table
		if (selectedGroups.size === 0) {
			return [{ name: null, formats }];
		}

		const result: { name: string | null; formats: any[] }[] = [];
		const assigned = new Set<string>();

		// Process each group in order
		for (const group of groups) {
			if (!selectedGroups.has(group.key)) continue;

			const groupFormats = formats.filter((format) => {
				// Skip if already assigned
				if (assigned.has(format.name)) return false;

				// Check if format has any of the group's tags
				return format.tags?.some((tag: string) => group.tags.includes(tag.toLowerCase()));
			});

			// Mark as assigned
			groupFormats.forEach((f) => assigned.add(f.name));

			result.push({ name: group.name, formats: groupFormats });
		}

		// Add remaining formats to "Other" group
		const otherFormats = formats.filter((f) => !assigned.has(f.name));
		if (otherFormats.length > 0) {
			result.push({ name: 'Other', formats: otherFormats });
		}

		return result;
	}
</script>

<svelte:head>
	<title>Scoring - Profilarr</title>
</svelte:head>

{#if scoring}
	<StickyCard position="top">
		<svelte:fragment slot="left">
			<h1 class="text-neutral-900 dark:text-neutral-50">Scoring</h1>
			<p class="text-neutral-600 dark:text-neutral-400">Configure custom format scores</p>
		</svelte:fragment>
		<svelte:fragment slot="right">
			<div class="flex items-center gap-2">
				<Button text="Scoring" icon={Info} on:click={() => (showInfoModal = true)} />
				<Button text="Options" icon={Info} on:click={() => (showOptionsInfoModal = true)} />
				<Button
					disabled={isSaving || !$isDirty}
					icon={isSaving ? Loader2 : Save}
					iconColor="text-blue-600 dark:text-blue-400"
					text={isSaving ? 'Saving...' : 'Save'}
					on:click={handleSaveClick}
				/>
			</div>
		</svelte:fragment>
	</StickyCard>

	<!-- Hidden form for submission -->
	<form
		bind:this={formElement}
		method="POST"
		action="?/update"
		class="hidden"
		use:enhance={() => {
			isSaving = true;
			saveError = null;
			return async ({ result, update: formUpdate }) => {
				isSaving = false;
				if (result.type === 'success' && result.data) {
					const resData = result.data as {
						success?: boolean;
						redirectTo?: string;
						affectedArrs?: AffectedArr[];
					};
					if (resData.success) {
						alertStore.add('success', 'Scoring saved!');
						initEdit($current);
						if (resData.affectedArrs && resData.affectedArrs.length > 0) {
							pendingRedirectTo = resData.redirectTo || '';
							pendingAffectedArrs = resData.affectedArrs;
							showSyncModal = true;
						} else {
							await formUpdate();
						}
						return;
					}
				} else if (result.type === 'failure') {
					saveError = (result.data as { error?: string })?.error || 'Failed to save';
					alertStore.add('error', saveError);
				}
				await formUpdate();
			};
		}}
	>
		<input type="hidden" name="minimumScore" value={minimumScore} />
		<input type="hidden" name="upgradeUntilScore" value={upgradeUntilScore} />
		<input type="hidden" name="upgradeScoreIncrement" value={upgradeScoreIncrement} />
		<input type="hidden" name="customFormatScores" value={customFormatScoresPayload} />
		<input type="hidden" name="layer" value={selectedLayer} />
	</form>

	<div class="mt-6 space-y-6 md:px-4">
		<!-- Profile-level Score Settings -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<div class="space-y-2">
				<label
					for="minimumScore"
					class="block text-sm font-medium text-neutral-900 dark:text-neutral-100"
				>
					Minimum Score
				</label>
				<p class="text-xs text-neutral-600 dark:text-neutral-400">
					Minimum custom format score required to download
				</p>
				<NumberInput
					name="minimumScore"
					value={minimumScore}
					onchange={(v) => update('minimumScore', v)}
					step={1}
					font="mono"
				/>
			</div>

			<div class="space-y-2">
				<label
					for="upgradeUntilScore"
					class="block text-sm font-medium text-neutral-900 dark:text-neutral-100"
				>
					Upgrade Until Score
				</label>
				<p class="text-xs text-neutral-600 dark:text-neutral-400">
					Stop upgrading when this score is reached
				</p>
				<NumberInput
					name="upgradeUntilScore"
					value={upgradeUntilScore}
					onchange={(v) => update('upgradeUntilScore', v)}
					step={1}
					font="mono"
				/>
			</div>

			<div class="space-y-2">
				<label
					for="upgradeScoreIncrement"
					class="block text-sm font-medium text-neutral-900 dark:text-neutral-100"
				>
					Upgrade Score Increment
				</label>
				<p class="text-xs text-neutral-600 dark:text-neutral-400">
					Minimum score improvement needed to upgrade
				</p>
				<NumberInput
					name="upgradeScoreIncrement"
					value={upgradeScoreIncrement}
					onchange={(v) => update('upgradeScoreIncrement', v)}
					step={1}
					font="mono"
				/>
			</div>
		</div>

		<!-- Custom Format Scoring -->

		<ActionsBar className="md:w-full">
			<SearchAction {searchStore} placeholder="Search custom formats..." responsive />
			<ActionButton icon={ArrowUpDown} hasDropdown={true} dropdownPosition="right">
				<svelte:fragment slot="dropdown" let:dropdownPosition let:open>
					<Dropdown position={dropdownPosition} mobilePosition="middle" minWidth="10rem">
						<DropdownHeader label="Sort by" />
						<DropdownItem
							label="Name"
							selected={sortState?.key === 'name'}
							checkIcon={sortState?.key === 'name' && sortState.direction === 'desc'
								? ArrowDown
								: ArrowUp}
							checkColor="blue"
							on:click={() => toggleSort('name', 'asc')}
						/>
						<DropdownItem
							label="Radarr"
							selected={sortState?.key === 'radarr'}
							checkIcon={sortState?.key === 'radarr' && sortState.direction === 'asc'
								? ArrowUp
								: ArrowDown}
							checkColor={getArrTypeColor('radarr')}
							on:click={() => toggleSort('radarr', 'desc')}
						/>
						<DropdownItem
							label="Sonarr"
							selected={sortState?.key === 'sonarr'}
							checkIcon={sortState?.key === 'sonarr' && sortState.direction === 'asc'
								? ArrowUp
								: ArrowDown}
							checkColor={getArrTypeColor('sonarr')}
							on:click={() => toggleSort('sonarr', 'desc')}
						/>
					</Dropdown>
				</svelte:fragment>
			</ActionButton>
			<ActionButton icon={Layers} hasDropdown={true} dropdownPosition="right">
				<svelte:fragment slot="dropdown" let:dropdownPosition let:open>
					<Dropdown position={dropdownPosition} mobilePosition="middle" minWidth="14rem">
						<DropdownHeader label="Group by" />
						<DropdownItem
							label="No Grouping"
							selected={selectedGroups.size === 0}
							checkColor="blue"
							on:click={clearGrouping}
						/>
						{#each builtInGroups as group}
							<DropdownItem
								label={group.name}
								selected={selectedGroups.has(group.key)}
								checkColor="blue"
								on:click={() => toggleGroup(group.key)}
							/>
						{/each}
						<CustomGroupManager
							{customGroups}
							{selectedGroups}
							onAdd={addCustomGroup}
							onDelete={deleteCustomGroup}
							onToggle={toggleGroup}
						/>
					</Dropdown>
				</svelte:fragment>
			</ActionButton>
			<ActionButton icon={LayoutGrid} hasDropdown={true} dropdownPosition="right">
				<svelte:fragment slot="dropdown" let:dropdownPosition let:open>
					<Dropdown position={dropdownPosition} mobilePosition="middle" minWidth="10rem">
						<DropdownHeader label="Grid columns" />
						{#each [1, 2, 3] as columns}
							<DropdownItem
								label={`${columns} Column${columns > 1 ? 's' : ''}`}
								selected={tileColumns === columns}
								checkColor="blue"
								on:click={() => setTileColumns(columns)}
							/>
						{/each}
					</Dropdown>
				</svelte:fragment>
			</ActionButton>
			{#if scoring.arrTypes.length > 1}
				<ActionButton icon={Eye} hasDropdown={true} dropdownPosition="right">
					<svelte:fragment slot="dropdown" let:dropdownPosition>
						<Dropdown position={dropdownPosition} minWidth="10rem">
							<DropdownHeader label="Columns" />
							{#each scoring.arrTypes as arrType}
								<DropdownItem
									label={arrType.charAt(0).toUpperCase() + arrType.slice(1)}
									selected={!hiddenArrTypes.has(arrType)}
									checkColor={getArrTypeColor(arrType)}
									on:click={() => toggleArrTypeVisibility(arrType)}
								/>
							{/each}
						</Dropdown>
					</svelte:fragment>
				</ActionButton>
			{/if}
			<ActionButton icon={Settings} hasDropdown={true} dropdownPosition="right">
				<svelte:fragment slot="dropdown" let:dropdownPosition let:open>
					<Dropdown position={dropdownPosition} minWidth="14rem">
						<DropdownHeader label="Display" />
						<DropdownItem
							label="Hide Unscored Formats"
							selected={hideUnscoredFormats}
							checkColor="blue"
							on:click={toggleHideUnscored}
						/>
					</Dropdown>
				</svelte:fragment>
			</ActionButton>
			<ActionButton icon={User} hasDropdown={true} dropdownPosition="right">
				<svelte:fragment slot="dropdown" let:dropdownPosition let:open>
					<Dropdown position={dropdownPosition} minWidth="16rem">
						<!-- Save current config form -->
						<div class="border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
							<div class="mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
								Save Current Settings
							</div>
							<form on:submit|preventDefault={handleSaveProfile} class="space-y-2">
								<FormInput
									label="Profile name"
									name="profileName"
									placeholder="Profile name"
									bind:value={newProfileName}
									hideLabel
									size="sm"
								/>
								<Button
									type="submit"
									text="Save Profile"
									icon={Plus}
									variant="primary"
									size="xs"
									fullWidth
									disabled={!newProfileName.trim()}
								/>
							</form>
						</div>

						<!-- Saved profiles list -->
						<DropdownHeader label="Profiles" />
						<DropdownItem
							label="Default"
							selected={currentProfileId === null}
							checkColor="blue"
							on:click={loadDefaultProfile}
						/>
						{#each profiles as profile}
							<DropdownItem
								label={profile.name}
								selected={currentProfileId === profile.id}
								checkColor="blue"
								on:click={() => loadProfile(profile.id)}
							>
								<svelte:fragment slot="actions">
									<Button
										variant="ghost"
										size="xs"
										icon={X}
										ariaLabel="Delete profile"
										tooltip="Delete profile"
										on:click={(e) => {
											e.stopPropagation();
											deleteProfile(profile.id);
										}}
									/>
								</svelte:fragment>
							</DropdownItem>
						{/each}
					</Dropdown>
				</svelte:fragment>
			</ActionButton>
		</ActionsBar>

		<!-- Custom Format Scores Tables -->
		{#if searchQuery === 'santiagoisthebest'}
			<div
				class="flex items-center justify-center rounded-lg border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900"
			>
				<img src="/src/lib/client/assets/thanks.gif" alt="Thanks!" class="max-w-full" />
			</div>
		{:else if searchQuery === 'rickroll' || searchQuery === 'nevergonnagiveyouup'}
			<div
				class="flex items-center justify-center rounded-lg border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900"
			>
				<img
					src="/src/lib/client/assets/nggyu.gif"
					alt="Never gonna give you up"
					class="max-w-full"
				/>
			</div>
		{:else if sortedCustomFormats.length === 0}
			<div class="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
				<div class="px-6 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
					{#if scoring.customFormats.length === 0}
						No custom formats found
					{:else}
						No custom formats match your search
					{/if}
				</div>
			</div>
		{:else}
			<div
				class="grid gap-6"
				class:grid-cols-1={tileColumns === 1}
				class:grid-cols-2={tileColumns === 2}
				class:grid-cols-3={tileColumns === 3}
			>
				{#each groupedFormats as group}
					{#if group.formats.length > 0}
						<div class="min-w-0">
							<ScoringTable
								formats={group.formats}
								arrTypes={visibleArrTypes}
								{customFormatScores}
								{customFormatEnabled}
								{getArrTypeColor}
								title={group.name}
								on:scoreChange={handleScoreChange}
								on:enabledChange={handleEnabledChange}
							/>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
{/if}

<InfoModal bind:open={showInfoModal} header="Custom Format Scoring">
	<div class="space-y-4 text-sm text-neutral-600 dark:text-neutral-400">
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Custom Format Scores</div>
			<div class="mt-1">
				Each custom format can have different scores for different Arr types (Radarr, Sonarr). The
				score determines how much a release is preferred when it matches the custom format.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Minimum Score</div>
			<div class="mt-1">
				The minimum total custom format score required for a release to be downloaded. Releases with
				scores below this threshold will be rejected.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Upgrade Until Score</div>
			<div class="mt-1">
				Once a release reaches this score, the system will stop looking for upgrades. This prevents
				unnecessary upgrades when you've already got a good quality release.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Upgrade Score Increment</div>
			<div class="mt-1">
				The minimum score improvement required to trigger an upgrade. This prevents minor upgrades
				that don't significantly improve quality.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">
				Positive vs Negative Scores
			</div>
			<div class="mt-1">
				Positive scores increase preference for releases matching the custom format. Negative scores
				decrease preference or can block releases entirely when combined with the minimum score
				setting.
			</div>
		</div>
	</div>
</InfoModal>

<InfoModal bind:open={showOptionsInfoModal} header="Display Options">
	<div class="space-y-4 text-sm text-neutral-600 dark:text-neutral-400">
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Search</div>
			<div class="mt-1">
				Filter custom formats by name. The search is case-insensitive and matches any part of the
				format name.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Sort</div>
			<div class="mt-1">
				Sort custom formats by Name (A-Z), Radarr score, or Sonarr score. Click the same option
				again to reverse the sort direction (ascending ↑ or descending ↓). Formats with no score are
				always shown at the end.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Grouping</div>
			<div class="mt-1">
				Organize custom formats into separate tables based on their tags. You can select multiple
				groups at once. Available groups include Audio, HDR, Release Group, Codec, Resolution, and
				more. Formats that don't match any selected group appear in the "Other" table. If a format
				matches multiple groups, it appears in the first matching group only.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Custom Groups</div>
			<div class="mt-1">
				Create your own custom groups by entering a name and comma-separated tags at the bottom of
				the Grouping dropdown. Your custom groups are saved to your browser and can be deleted at
				any time. Custom groups work the same as built-in groups - formats are assigned to the first
				matching group based on their tags.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Tiling</div>
			<div class="mt-1">
				Display tables in 1, 2, or 3 columns. This is especially useful when using grouping to view
				multiple format categories side-by-side.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Hide Unscored Formats</div>
			<div class="mt-1">
				Hide custom formats that have no score assigned for any Arr type. This helps focus on
				formats that are currently being used in your quality profile.
			</div>
		</div>

		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Profiles</div>
			<div class="mt-1">
				Save your current display configuration (search, sort, grouping, custom groups, tiling, and
				options) as a named profile. Load saved profiles to quickly switch between different views.
				The "Default" profile resets everything to the baseline configuration. Profiles are stored
				in your browser and automatically uncheck when you modify any settings.
			</div>
		</div>
	</div>
</InfoModal>

<SyncPromptModal
	bind:open={showSyncModal}
	redirectTo={pendingRedirectTo}
	affectedArrs={pendingAffectedArrs}
	{databaseId}
	entityName={data.profileName}
/>
