<script lang="ts">
	import type { QualityProfileTableRow } from '$shared/pcd/display.ts';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import DraggableCard from '$ui/list/DraggableCard.svelte';
	import SyncFooter from './SyncFooter.svelte';
	import ProgressIndicator from '$ui/arr/ProgressIndicator.svelte';
	import { ChevronUp, ChevronDown } from 'lucide-svelte';
	import { alertStore } from '$lib/client/alerts/store.ts';
	import { deserialize } from '$app/forms';
	import { jobStatus } from '$stores/jobStatus';

	interface DatabaseWithProfiles {
		id: number;
		name: string;
		qualityProfiles: QualityProfileTableRow[];
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
	export let state: Record<number, Record<string, boolean>> = {};
	export let syncTrigger: 'manual' | 'on_pull' | 'schedule' = 'manual';
	export let cronExpression: string = '0 * * * *';
	export let canSave: boolean = true;
	export let warning: string | null = null;
	export let qpProgress: SectionProgress | undefined = undefined;
	export let cfProgress: SectionProgress | undefined = undefined;

	let saving = false;
	let syncing = false;

	// Track saved state for dirty detection
	let savedState = JSON.stringify({ state, syncTrigger, cronExpression, databasePriorities });
	$: currentState = JSON.stringify({ state, syncTrigger, cronExpression, databasePriorities });
	export let isDirty = false;
	$: isDirty = currentState !== savedState;

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
					state[db.id][profile.name] = false;
				}
			}
		}
	}

	// Reactive set of selected keys for checkbox state
	$: selectedKeys = new Set(
		Object.entries(state).flatMap(([dbId, profiles]) =>
			Object.entries(profiles)
				.filter(([, selected]) => selected)
				.map(([profileName]) => `${dbId}-${profileName}`)
		)
	);

	function isSelected(databaseId: number, profileName: string): boolean {
		return selectedKeys.has(`${databaseId}-${profileName}`);
	}

	$: hasAnySelection = Object.values(state).some((db) =>
		Object.values(db).some((selected) => selected)
	);

	function setProfile(databaseId: number, profileName: string, checked: boolean) {
		state[databaseId][profileName] = checked;
		state = { ...state };
	}

	function getSelections(): { databaseId: number; profileName: string }[] {
		const selections: { databaseId: number; profileName: string }[] = [];
		for (const [dbId, profiles] of Object.entries(state)) {
			for (const [profileName, selected] of Object.entries(profiles)) {
				if (selected) {
					selections.push({ databaseId: parseInt(dbId), profileName });
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

			const response = await fetch('?/saveQualityProfiles', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				alertStore.add('success', 'Quality profiles sync config saved');
				savedState = JSON.stringify({ state, syncTrigger, cronExpression, databasePriorities });
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
		{#if qpProgress || cfProgress}
			<div class="flex flex-col gap-3 md:flex-shrink-0 md:flex-row md:flex-wrap md:gap-5 md:pt-1">
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
									<span
										class="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"
									>
										{index + 1}
									</span>
								</div>
								<!-- Mobile reorder buttons -->
								<div class="flex gap-1 md:hidden">
									<button
										class="rounded p-1 text-neutral-400 hover:text-neutral-600 disabled:opacity-30 dark:text-neutral-500 dark:hover:text-neutral-300"
										disabled={index === 0}
										onclick={() => moveDatabase(index, -1)}
										aria-label="Move up"
									>
										<ChevronUp size={16} />
									</button>
									<button
										class="rounded p-1 text-neutral-400 hover:text-neutral-600 disabled:opacity-30 dark:text-neutral-500 dark:hover:text-neutral-300"
										disabled={index === orderedDatabases.length - 1}
										onclick={() => moveDatabase(index, 1)}
										aria-label="Move down"
									>
										<ChevronDown size={16} />
									</button>
								</div>
							</div>

							{#if database.qualityProfiles.length === 0}
								<p class="text-sm text-neutral-500 dark:text-neutral-400">No quality profiles</p>
							{:else}
								<div class="grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-5">
									{#each database.qualityProfiles as profile}
										<Toggle
											checked={isSelected(database.id, profile.name)}
											label={profile.name}
											fullWidth
											ariaLabel={`Toggle quality profile ${profile.name} from ${database.name}`}
											on:change={(e) => setProfile(database.id, profile.name, e.detail)}
										/>
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
