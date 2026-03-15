<script lang="ts">
	import type { DelayProfilesRow } from '$shared/pcd/display.ts';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import SyncFooter from './SyncFooter.svelte';
	import { alertStore } from '$lib/client/alerts/store.ts';
	import { deserialize } from '$app/forms';

	interface DatabaseWithProfiles {
		id: number;
		name: string;
		delayProfiles: DelayProfilesRow[];
	}

	export let databases: DatabaseWithProfiles[];
	export let state: {
		databaseId: number | null;
		profileName: string | null;
	} = {
		databaseId: null,
		profileName: null
	};
	export let syncTrigger: 'manual' | 'on_pull' | 'schedule' = 'manual';
	export let cronExpression: string = '0 * * * *';

	let saving = false;
	let syncing = false;

	// Track saved state for dirty detection
	let savedState = JSON.stringify({ state, syncTrigger, cronExpression });
	$: currentState = JSON.stringify({ state, syncTrigger, cronExpression });
	export let isDirty = false;
	$: isDirty = currentState !== savedState;

	// Reactive selected key for checkbox state
	$: selectedKey =
		state.databaseId !== null && state.profileName !== null
			? `${state.databaseId}-${state.profileName}`
			: null;

	function isSelected(databaseId: number, profileName: string): boolean {
		return selectedKey === `${databaseId}-${profileName}`;
	}

	function setProfile(databaseId: number, profileName: string, checked: boolean) {
		if (checked) {
			// Single selection: enabling one disables any previous selection.
			state = { databaseId, profileName };
			return;
		}

		if (isSelected(databaseId, profileName)) {
			state = { databaseId: null, profileName: null };
		}
	}

	async function handleSave() {
		saving = true;
		try {
			const formData = new FormData();
			formData.set('databaseId', state.databaseId?.toString() ?? '');
			formData.set('profileName', state.profileName ?? '');
			formData.set('trigger', syncTrigger);
			formData.set('cron', cronExpression);

			const response = await fetch('?/saveDelayProfiles', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				alertStore.add('success', 'Delay profile sync config saved');
				// Update saved state to current
				savedState = JSON.stringify({ state, syncTrigger, cronExpression });
			} else {
				alertStore.add('error', 'Failed to save delay profile sync config');
			}
		} catch {
			alertStore.add('error', 'Failed to save delay profile sync config');
		} finally {
			saving = false;
		}
	}

	async function handleSync() {
		syncing = true;
		try {
			const response = await fetch('?/syncDelayProfiles', {
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
	class="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
>
	<!-- Header -->
	<div class="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
		<h2 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Delay Profiles</h2>
		<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
			Select delay profiles to sync to this instance
		</p>
	</div>

	<!-- Content -->
	<div class="p-6">
		{#if databases.length === 0}
			<p class="text-sm text-neutral-500 dark:text-neutral-400">No databases configured</p>
		{:else}
			<div class="space-y-6">
				{#each databases as database}
					<div class="space-y-3">
						<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							{database.name}
						</h3>

						{#if database.delayProfiles.length === 0}
							<p class="text-sm text-neutral-500 dark:text-neutral-400">No delay profiles</p>
						{:else}
							<div class="grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-5">
								{#each database.delayProfiles as profile}
									<Toggle
										checked={selectedKey === `${database.id}-${profile.name}`}
										label={profile.name}
										fullWidth
										ariaLabel={`Toggle delay profile ${profile.name} from ${database.name}`}
										on:change={(e) => setProfile(database.id, profile.name, e.detail)}
									/>
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
		hasConfig={state.databaseId !== null && state.profileName !== null}
		onWarning={(msg) => alertStore.add('warning', msg)}
		on:save={handleSave}
		on:sync={handleSync}
	/>
</div>
