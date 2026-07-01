<script lang="ts">
	import type { QualityProfileTableRow } from '$shared/pcd/display.ts';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import SyncFooter from './SyncFooter.svelte';
	import ProgressIndicator from '$ui/arr/ProgressIndicator.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
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

	export let databases: DatabaseWithProfiles[];
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
	let savedState = JSON.stringify({ state, syncTrigger, cronExpression });
	$: currentState = JSON.stringify({ state, syncTrigger, cronExpression });
	export let isDirty = false;
	$: isDirty = currentState !== savedState;

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

	// Track which database currently has selections (null = none)
	$: activeDatabaseId = (() => {
		for (const [dbId, profiles] of Object.entries(state)) {
			if (Object.values(profiles).some((selected) => selected)) {
				return parseInt(dbId);
			}
		}
		return null;
	})();

	function setProfile(databaseId: number, profileName: string, checked: boolean) {
		if (checked) {
			// Clear selections from other databases (1 database per category)
			for (const dbId of Object.keys(state)) {
				if (parseInt(dbId) !== databaseId) {
					for (const name of Object.keys(state[parseInt(dbId)])) {
						state[parseInt(dbId)][name] = false;
					}
				}
			}
		}
		state[databaseId][profileName] = checked;
		state = { ...state }; // Reassign to trigger reactivity
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

	async function handleSave() {
		saving = true;
		try {
			const formData = new FormData();
			formData.set('selections', JSON.stringify(getSelections()));
			formData.set('trigger', syncTrigger);
			formData.set('cron', cronExpression);

			const response = await fetch('?/saveQualityProfiles', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				alertStore.add('success', 'Quality profiles sync config saved');
				// Update saved state to current
				savedState = JSON.stringify({ state, syncTrigger, cronExpression });
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

<div data-onboarding="sync-quality-profiles" class="rounded-card border border-border bg-surface">
	<!-- Header -->
	<div
		class="flex flex-col gap-4 border-b border-border px-6 py-4 md:flex-row md:items-start md:justify-between md:gap-6"
	>
		<div class="min-w-0 md:flex-1">
			<h2 class="text-xl font-semibold text-text">Quality Profiles</h2>
			<p class="mt-1 text-sm text-text-soft">Select quality profiles to sync to this instance.</p>
		</div>
		{#if qpProgress || cfProgress}
			<div class="flex flex-col gap-3 md:flex-shrink-0 md:flex-row md:flex-wrap md:gap-5 md:pt-1">
				{#if qpProgress}
					<div class="min-w-[9rem]">
						<div class="mb-1 text-xs font-medium text-text-muted">Quality Profiles</div>
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
						<div class="mb-1 text-xs font-medium text-text-muted">Custom Formats</div>
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
		{#if databases.length === 0}
			<p class="text-sm text-text-muted">No databases configured</p>
		{:else}
			<div class="space-y-6">
				{#each databases as database}
					{@const isInactive = activeDatabaseId !== null && activeDatabaseId !== database.id}
					<div class="space-y-3">
						<h3 class="text-sm font-semibold text-text" class:opacity-50={isInactive}>
							{database.name}
						</h3>

						{#if database.qualityProfiles.length === 0}
							<p class="text-sm text-text-muted">No quality profiles</p>
						{:else}
							<div class="grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-5">
								{#each database.qualityProfiles as profile}
									<Tooltip
										text={isInactive ? 'Only one database can be used per instance.' : ''}
										position="bottom"
										fullWidth
									>
										<Toggle
											checked={isSelected(database.id, profile.name)}
											disabled={isInactive}
											label={profile.name}
											fullWidth
											ariaLabel={`Toggle quality profile ${profile.name} from ${database.name}`}
											on:change={(e) => setProfile(database.id, profile.name, e.detail)}
										/>
									</Tooltip>
								{/each}
							</div>
						{/if}
					</div>
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
