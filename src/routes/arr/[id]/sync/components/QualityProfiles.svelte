<script context="module" lang="ts">
	/** Per database, per profile: whether it syncs and which quality definitions config sizes it (null = the instance's pick). */
	export type ProfileSyncState = Record<
		number,
		Record<string, { selected: boolean; sizes: string | null }>
	>;
</script>

<script lang="ts">
	import type { QualityProfileTableRow } from '$shared/pcd/display.ts';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import DraggableCard from '$ui/list/DraggableCard.svelte';
	import SyncFooter from './SyncFooter.svelte';
	import ProgressIndicator from '$ui/arr/ProgressIndicator.svelte';
	import Label from '$ui/label/Label.svelte';
	import Button from '$ui/button/Button.svelte';
	import { ChevronUp, ChevronDown } from '@lucide/svelte';
	import { alertStore } from '$lib/client/alerts/store.ts';
	import { deserialize } from '$app/forms';
	import { jobStatus } from '$stores/jobStatus';

	interface DatabaseWithProfiles {
		id: number;
		name: string;
		qualityProfiles: QualityProfileTableRow[];
		qualityDefinitionsConfigs: { name: string }[];
	}

	interface SectionProgress {
		total: number;
		drifted: number;
		message?: string;
	}

	interface DatabasePriority {
		databaseId: number;
		priority: number;
	}

	export let databases: DatabaseWithProfiles[];
	export let databasePriorities: DatabasePriority[] = [];
	/**
	 * The Arr keeps size limits on each quality profile (Sonarr v5). This
	 * section then owns the instance's global quality definitions pick and
	 * each synced profile may choose its own.
	 */
	export let profileItemSizes: boolean = false;
	/** The instance's quality definitions pick, shared with Media Management's state */
	export let globalQualityDefinitionsDatabaseId: number | null = null;
	export let globalQualityDefinitionsConfigName: string | null = null;
	export let state: ProfileSyncState = {};
	export let syncTrigger: 'manual' | 'on_pull' | 'schedule' = 'manual';
	export let cronExpression: string = '0 * * * *';
	export let canSave: boolean = true;
	export let warning: string | null = null;
	export let qpProgress: SectionProgress | undefined = undefined;
	export let cfProgress: SectionProgress | undefined = undefined;

	let saving = false;
	let syncing = false;

	// Track saved state for dirty detection. The default definitions pick is
	// only this section's concern where sizes live on profiles.
	function snapshot(): string {
		return JSON.stringify({
			state,
			syncTrigger,
			cronExpression,
			databasePriorities,
			...(profileItemSizes
				? {
						globalQualityDefinitionsDatabaseId,
						globalQualityDefinitionsConfigName
					}
				: {})
		});
	}
	let savedState = snapshot();
	$: currentState = (() => {
		// Reactive on every tracked field
		void state;
		void syncTrigger;
		void cronExpression;
		void databasePriorities;
		void globalQualityDefinitionsDatabaseId;
		void globalQualityDefinitionsConfigName;
		return snapshot();
	})();
	export let isDirty = false;
	$: isDirty = currentState !== savedState;

	// ── Quality definitions pick (sizes live on profiles) ───────────────

	type SelectionOption = { value: string; label: string };

	$: globalOptions = databases.flatMap((db) =>
		db.qualityDefinitionsConfigs.map((config) => ({
			value: JSON.stringify([db.id, config.name]),
			label: `${db.name} / ${config.name}`
		}))
	) as SelectionOption[];

	$: globalValue =
		globalQualityDefinitionsDatabaseId !== null && globalQualityDefinitionsConfigName
			? JSON.stringify([globalQualityDefinitionsDatabaseId, globalQualityDefinitionsConfigName])
			: '';

	function selectGlobal(value: string) {
		try {
			const parsed = value ? JSON.parse(value) : null;
			if (Array.isArray(parsed) && parsed.length === 2) {
				const databaseId = Number(parsed[0]);
				const configName = String(parsed[1]);
				if (!Number.isNaN(databaseId) && configName) {
					globalQualityDefinitionsDatabaseId = databaseId;
					globalQualityDefinitionsConfigName = configName;
					return;
				}
			}
		} catch {
			// Malformed values clear the pick
		}
		globalQualityDefinitionsDatabaseId = null;
		globalQualityDefinitionsConfigName = null;
	}

	function sizeOptions(database: DatabaseWithProfiles): SelectionOption[] {
		return [
			{ value: '', label: 'Global' },
			...database.qualityDefinitionsConfigs.map((config) => ({
				value: config.name,
				label: config.name
			}))
		];
	}

	function setSizes(databaseId: number, profileName: string, value: string) {
		const entry = state[databaseId]?.[profileName] ?? { selected: false, sizes: null };
		state[databaseId][profileName] = { ...entry, sizes: value || null };
		state = { ...state };
	}

	// Order databases by priority
	$: orderedDatabases = [...databases].sort((a, b) => {
		const pa = databasePriorities.find((p) => p.databaseId === a.id)?.priority ?? Infinity;
		const pb = databasePriorities.find((p) => p.databaseId === b.id)?.priority ?? Infinity;
		return pa - pb;
	});

	// Initialize state for all databases/profiles
	$: {
		for (const db of databases) {
			if (!state[db.id]) {
				state[db.id] = {};
			}
			for (const profile of db.qualityProfiles) {
				if (state[db.id][profile.name] === undefined) {
					state[db.id][profile.name] = { selected: false, sizes: null };
				}
			}
		}
	}

	// Reactive set of selected keys for checkbox state
	$: selectedKeys = new Set(
		Object.entries(state).flatMap(([dbId, profiles]) =>
			Object.entries(profiles)
				.filter(([, profile]) => profile.selected)
				.map(([profileName]) => `${dbId}-${profileName}`)
		)
	);

	function isSelected(databaseId: number, profileName: string): boolean {
		return selectedKeys.has(`${databaseId}-${profileName}`);
	}

	$: hasAnySelection = Object.values(state).some((db) =>
		Object.values(db).some((profile) => profile.selected)
	);

	function setProfile(databaseId: number, profileName: string, checked: boolean) {
		const entry = state[databaseId]?.[profileName] ?? { selected: false, sizes: null };
		state[databaseId][profileName] = { ...entry, selected: checked };
		state = { ...state };
	}

	function getSelections(): {
		databaseId: number;
		profileName: string;
		qualityDefinitionsConfigName: string | null;
	}[] {
		const selections: {
			databaseId: number;
			profileName: string;
			qualityDefinitionsConfigName: string | null;
		}[] = [];
		for (const [dbId, profiles] of Object.entries(state)) {
			for (const [profileName, profile] of Object.entries(profiles)) {
				if (profile.selected) {
					selections.push({
						databaseId: parseInt(dbId),
						profileName,
						qualityDefinitionsConfigName: profile.sizes
					});
				}
			}
		}
		return selections;
	}

	// ── Drag-and-drop reordering ────────────────────────────────────────

	let draggedDb: { id: number; index: number } | null = null;
	let hoverTargetIndex: number | null = null;
	let lastTargetIndex: number | null = null;

	function getTargetFromPoint(x: number, y: number): { index: number } | null {
		const el = document.elementFromPoint(x, y);
		const card = el?.closest('[data-db-index]') as HTMLElement | null;
		if (!card) return null;
		const idx = parseInt(card.dataset.dbIndex!, 10);
		if (isNaN(idx) || idx < 0 || idx >= orderedDatabases.length) return null;
		return { index: idx };
	}

	function handlePointerDown(e: PointerEvent, database: DatabaseWithProfiles, index: number) {
		e.preventDefault();
		document.body.classList.add('dragging');
		draggedDb = { id: database.id, index };
		document.addEventListener('pointermove', handlePointerMove);
		document.addEventListener('pointerup', handlePointerUp);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!draggedDb) return;
		const target = getTargetFromPoint(e.clientX, e.clientY);
		if (!target || target.index === lastTargetIndex) return;
		lastTargetIndex = target.index;
		hoverTargetIndex = target.index;

		if (target.index !== draggedDb.index) {
			const newOrder = [...orderedDatabases];
			const [moved] = newOrder.splice(draggedDb.index, 1);
			newOrder.splice(target.index, 0, moved);
			orderedDatabases = newOrder;
			databasePriorities = newOrder.map((db, i) => ({ databaseId: db.id, priority: i + 1 }));
			draggedDb = { ...draggedDb, index: target.index };
		}
	}

	function handlePointerUp() {
		resetDragState();
	}

	function resetDragState() {
		draggedDb = null;
		hoverTargetIndex = null;
		lastTargetIndex = null;
		document.removeEventListener('pointermove', handlePointerMove);
		document.removeEventListener('pointerup', handlePointerUp);
		document.body.classList.remove('dragging');
	}

	// Mobile reorder buttons
	function moveDatabase(index: number, direction: -1 | 1) {
		const newIndex = index + direction;
		if (newIndex < 0 || newIndex >= orderedDatabases.length) return;
		const newOrder = [...orderedDatabases];
		[newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
		orderedDatabases = newOrder;
		databasePriorities = newOrder.map((db, i) => ({ databaseId: db.id, priority: i + 1 }));
	}

	// ── Save / Sync ─────────────────────────────────────────────────────

	async function handleSave() {
		saving = true;
		try {
			const formData = new FormData();
			formData.set('selections', JSON.stringify(getSelections()));
			formData.set('priorities', JSON.stringify(databasePriorities));
			formData.set('trigger', syncTrigger);
			formData.set('cron', cronExpression);
			if (profileItemSizes) {
				formData.set(
					'qualityDefinitionsDatabaseId',
					globalQualityDefinitionsDatabaseId?.toString() ?? ''
				);
				formData.set('qualityDefinitionsConfigName', globalQualityDefinitionsConfigName ?? '');
			}

			const response = await fetch('?/saveQualityProfiles', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				alertStore.add('success', 'Quality profiles sync config saved');
				savedState = snapshot();
			} else {
				alertStore.add('error', 'Failed to save quality profiles sync config');
			}
		} catch {
			alertStore.add('error', 'Failed to save quality profiles sync config');
		} finally {
			saving = false;
		}
	}

	async function handleSync() {
		jobStatus.connect();
		syncing = true;
		try {
			const response = await fetch('?/syncQualityProfiles', {
				method: 'POST',
				body: new FormData()
			});

			const result = deserialize(await response.text());
			if (result.type === 'failure') {
				alertStore.add('warning', (result.data?.error as string) ?? 'Sync failed');
			}
		} catch {
			alertStore.add('error', 'Sync failed');
		} finally {
			syncing = false;
		}
	}
</script>

<div
	data-onboarding="sync-quality-profiles"
	class="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
>
	<!-- Header -->
	<div
		class="flex flex-col gap-4 border-b border-neutral-200 px-6 py-4 md:flex-row md:items-start md:justify-between md:gap-6 dark:border-neutral-800"
	>
		<div class="min-w-0 md:flex-1">
			<h2 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Quality Profiles</h2>
			<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
				Select quality profiles to sync. Drag databases to set priority.
			</p>
		</div>
		{#if profileItemSizes || qpProgress || cfProgress}
			<div class="flex flex-col gap-3 md:flex-shrink-0 md:flex-row md:flex-wrap md:gap-5 md:pt-1">
				{#if profileItemSizes}
					<div class="min-w-[9rem] md:w-56">
						<div class="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
							Global quality definition
						</div>
						<DropdownSelect
							value={globalValue}
							options={globalOptions}
							header="Global quality definition"
							placeholder={globalOptions.length === 0
								? 'No quality definitions available'
								: 'Select quality definition...'}
							fullWidth
							minWidth="0"
							position="right"
							fixed
							disabled={globalOptions.length === 0}
							on:change={(e) => selectGlobal(e.detail)}
						/>
					</div>
				{/if}
				{#if qpProgress}
					<div class="min-w-[9rem]">
						<div class="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
							Quality Profiles
						</div>
						<ProgressIndicator
							current={qpProgress.total - qpProgress.drifted}
							target={qpProgress.total}
							met={qpProgress.drifted === 0}
							mode="compact"
							colorMode="completion"
							tooltip={qpProgress.message ?? ''}
							tooltipPosition="bottom"
							tooltipAlign="middle"
						/>
					</div>
				{/if}
				{#if cfProgress}
					<div class="min-w-[9rem]">
						<div class="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
							Custom Formats
						</div>
						<ProgressIndicator
							current={cfProgress.total - cfProgress.drifted}
							target={cfProgress.total}
							met={cfProgress.drifted === 0}
							mode="compact"
							colorMode="completion"
							tooltip={cfProgress.message ?? ''}
							tooltipPosition="bottom"
							tooltipAlign="middle"
						/>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Content -->
	<div class="p-6">
		{#if orderedDatabases.length === 0}
			<p class="text-sm text-neutral-500 dark:text-neutral-400">No databases configured</p>
		{:else}
			<div class="space-y-3">
				{#each orderedDatabases as database, index (database.id)}
					<DraggableCard
						isDragging={draggedDb?.index === index}
						onDragHandlePointerDown={(e) => handlePointerDown(e, database, index)}
						contentClass="p-4"
						data-db-index={index}
					>
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
										{database.name}
									</h3>
									<!-- Mobile reorder buttons -->
									<div class="flex gap-1 md:hidden">
										<Button
											icon={ChevronUp}
											size="xs"
											disabled={index === 0}
											on:click={() => moveDatabase(index, -1)}
										/>
										<Button
											icon={ChevronDown}
											size="xs"
											disabled={index === orderedDatabases.length - 1}
											on:click={() => moveDatabase(index, 1)}
										/>
									</div>
								</div>
								<Label variant="info" size="sm" rounded="md">
									Priority #{index + 1}
								</Label>
							</div>

							{#if database.qualityProfiles.length === 0}
								<p class="text-sm text-neutral-500 dark:text-neutral-400">No quality profiles</p>
							{:else}
								<div class="grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-5">
									{#each database.qualityProfiles as profile}
										{@const entry = state[database.id]?.[profile.name]}
										<!-- Where sizes live on profiles, every tile carries its size picker, joined below the toggle -->
										<!-- Joined tile: on press the whole block scales as one, in place of the toggle's own press scale -->
										<div
											class="flex flex-col [&>*+*]:-mt-px {profileItemSizes ? 'profile-tile' : ''}"
										>
											<Toggle
												checked={isSelected(database.id, profile.name)}
												label={profile.name}
												fullWidth
												rounded={profileItemSizes ? 'top' : 'all'}
												ariaLabel={`Toggle quality profile ${profile.name} from ${database.name}`}
												on:change={(e) => setProfile(database.id, profile.name, e.detail)}
											/>
											{#if profileItemSizes}
												<!-- Locked until the profile is ticked: not-allowed cursor, grey italic text, no fading -->
												<div
													class="[&_button]:opacity-100 {entry?.selected
														? ''
														: '[&_button]:text-neutral-400 [&_button]:italic dark:[&_button]:text-neutral-500'}"
												>
													<DropdownSelect
														value={entry?.sizes ?? ''}
														options={sizeOptions(database)}
														header="Quality definition"
														fixed
														fullWidth
														rounded="bottom"
														minWidth="0"
														disabled={!entry?.selected}
														on:change={(e) => setSizes(database.id, profile.name, e.detail)}
													/>
												</div>
											{:else if entry?.sizes}
												<Tooltip
													text="Only Sonarr v5 keeps size limits per profile. This choice is ignored here."
													position="top"
												>
													<Label variant="ghost" size="sm" rounded="md">
														Sizes: {entry.sizes} (ignored)
													</Label>
												</Tooltip>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</DraggableCard>
				{/each}
			</div>
		{/if}
	</div>

	<SyncFooter
		bind:syncTrigger
		bind:cronExpression
		{saving}
		{syncing}
		{isDirty}
		{canSave}
		hasConfig={hasAnySelection}
		{warning}
		onWarning={(msg) => alertStore.add('warning', msg)}
		on:save={handleSave}
		on:sync={handleSync}
	/>
</div>

<style>
	/*
	 * The joined tile scales as one when its toggle or its picker button is
	 * pressed. Pressing an item inside the open menu must not scale it: the
	 * menu is fixed-positioned inside the tile, and a scaled ancestor moves it
	 * out from under the pointer before the click lands.
	 */
	.profile-tile {
		transition: scale 150ms;
	}
	.profile-tile:has(> :global(:first-child:active)),
	.profile-tile:has(> :global(div > div > div > button:active)) {
		scale: 0.98;
	}
	/* The toggle's own press scale is cancelled inside the tile */
	.profile-tile > :global(:first-child:active) {
		scale: 1 !important;
		transform: none !important;
	}
</style>
