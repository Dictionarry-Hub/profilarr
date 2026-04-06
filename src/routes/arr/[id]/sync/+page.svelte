<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { Info } from 'lucide-svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Button from '$ui/button/Button.svelte';
	import QualityProfiles from './components/QualityProfiles.svelte';
	import DelayProfiles from './components/DelayProfiles.svelte';
	import MediaManagement from './components/MediaManagement.svelte';
	import type { SyncTrigger } from '$db/queries/arrSync.ts';
	import { initEdit, update, clear } from '$lib/client/stores/dirty';

	export let data: PageData;

	let showInfoModal = false;

	// Initialize state from loaded sync data
	function buildProfileState(
		selections: { databaseId: number; profileName: string }[]
	): Record<number, Record<string, boolean>> {
		const state: Record<number, Record<string, boolean>> = {};
		for (const sel of selections) {
			if (!state[sel.databaseId]) {
				state[sel.databaseId] = {};
			}
			state[sel.databaseId][sel.profileName] = true;
		}
		return state;
	}

	let qualityProfileState = buildProfileState(data.syncData.qualityProfiles.selections);
	let qualityProfileTrigger: SyncTrigger = data.syncData.qualityProfiles.config.trigger;
	let qualityProfileCron: string =
		(qualityProfileTrigger === 'schedule' && data.syncData.qualityProfiles.config.cron) ||
		'0 0 * * *';

	let delayProfileState = {
		databaseId: data.syncData.delayProfiles.databaseId,
		profileName: data.syncData.delayProfiles.profileName
	};
	let delayProfileTrigger: SyncTrigger = data.syncData.delayProfiles.trigger;
	let delayProfileCron: string =
		(delayProfileTrigger === 'schedule' && data.syncData.delayProfiles.cron) || '0 0 * * 0';

	let mediaManagementState = {
		namingDatabaseId: data.syncData.mediaManagement.namingDatabaseId,
		namingConfigName: data.syncData.mediaManagement.namingConfigName,
		qualityDefinitionsDatabaseId: data.syncData.mediaManagement.qualityDefinitionsDatabaseId,
		qualityDefinitionsConfigName: data.syncData.mediaManagement.qualityDefinitionsConfigName,
		mediaSettingsDatabaseId: data.syncData.mediaManagement.mediaSettingsDatabaseId,
		mediaSettingsConfigName: data.syncData.mediaManagement.mediaSettingsConfigName
	};
	let mediaManagementTrigger: SyncTrigger = data.syncData.mediaManagement.trigger;
	let mediaManagementCron: string =
		(mediaManagementTrigger === 'schedule' && data.syncData.mediaManagement.cron) || '0 0 * * 0';

	// Track dirty state from each component
	let qualityProfilesDirty = false;
	let delayProfilesDirty = false;
	let mediaManagementDirty = false;

	// Initialize dirty tracking on mount
	onMount(() => {
		initEdit({ anyDirty: false });
		return () => clear();
	});

	// Sync combined dirty state to global dirty store for DirtyModal
	$: anyDirty = qualityProfilesDirty || delayProfilesDirty || mediaManagementDirty;
	$: update('anyDirty', anyDirty);

	// Validation: Quality profiles require both media management AND delay profiles (saved, not dirty)
	$: hasQualityProfilesSelected = Object.values(qualityProfileState).some((db) =>
		Object.values(db).some((selected) => selected)
	);

	$: hasMediaManagement =
		typeof mediaManagementState.namingDatabaseId === 'number' &&
		typeof mediaManagementState.namingConfigName === 'string' &&
		typeof mediaManagementState.qualityDefinitionsDatabaseId === 'number' &&
		typeof mediaManagementState.qualityDefinitionsConfigName === 'string' &&
		typeof mediaManagementState.mediaSettingsDatabaseId === 'number' &&
		typeof mediaManagementState.mediaSettingsConfigName === 'string';

	$: hasDelayProfile =
		typeof delayProfileState.databaseId === 'number' &&
		typeof delayProfileState.profileName === 'string';

	$: qualityProfilesCanSave =
		!hasQualityProfilesSelected ||
		(hasMediaManagement && !mediaManagementDirty && hasDelayProfile && !delayProfilesDirty);

	// Build warning message showing all missing requirements
	$: qualityProfilesWarning = (() => {
		if (!hasQualityProfilesSelected) return null;

		const issues: string[] = [];

		if (!hasMediaManagement) {
			issues.push('media management settings');
		} else if (mediaManagementDirty) {
			issues.push('media management settings to be saved');
		}

		if (!hasDelayProfile) {
			issues.push('a delay profile');
		} else if (delayProfilesDirty) {
			issues.push('delay profile settings to be saved');
		}

		if (issues.length === 0) return null;
		return `Quality profiles require ${issues.join(' and ')}.`;
	})();
</script>

<svelte:head>
	<title>{data.instance.name} - Sync - Profilarr</title>
</svelte:head>

{#key data.instance.id}
	<div class="mt-6 space-y-6 pb-32">
		<!-- Header -->
		<StickyCard position="top">
			<svelte:fragment slot="left">
				<h1 class="text-neutral-900 dark:text-neutral-50">Sync Configuration</h1>
				<p class="text-neutral-600 dark:text-neutral-400">
					Configure which profiles and settings to sync to this instance.
				</p>
			</svelte:fragment>
			<svelte:fragment slot="right">
				<span data-onboarding="sync-how-it-works">
					<Button text="How it works" icon={Info} on:click={() => (showInfoModal = true)} />
				</span>
			</svelte:fragment>
		</StickyCard>

		<MediaManagement
			databases={data.databases}
			bind:state={mediaManagementState}
			bind:syncTrigger={mediaManagementTrigger}
			bind:cronExpression={mediaManagementCron}
			bind:isDirty={mediaManagementDirty}
		/>
		<DelayProfiles
			databases={data.databases}
			bind:state={delayProfileState}
			bind:syncTrigger={delayProfileTrigger}
			bind:cronExpression={delayProfileCron}
			bind:isDirty={delayProfilesDirty}
		/>
		<QualityProfiles
			databases={data.databases}
			bind:state={qualityProfileState}
			bind:syncTrigger={qualityProfileTrigger}
			bind:cronExpression={qualityProfileCron}
			bind:isDirty={qualityProfilesDirty}
			canSave={qualityProfilesCanSave}
			warning={qualityProfilesWarning}
		/>
	</div>

	<InfoModal bind:open={showInfoModal} header="How Sync Works">
		<div class="space-y-4 text-sm text-neutral-600 dark:text-neutral-400">
			<div>
				<div class="font-medium text-neutral-900 dark:text-neutral-100">Automatic Dependencies</div>
				<p class="mt-1">
					Quality Profiles will automatically sync the custom formats they need - you don't need to
					select them separately.
				</p>
			</div>

			<div>
				<div class="font-medium text-neutral-900 dark:text-neutral-100">
					One Database Per Instance
				</div>
				<p class="mt-1">
					Each Arr instance syncs from a single database. Quality profiles and their custom formats
					all come from the same database. If you want to use profiles from a different database,
					sync it to a separate Arr instance.
				</p>
			</div>

			<div>
				<div class="font-medium text-neutral-900 dark:text-neutral-100">Setup Order</div>
				<p class="mt-1">
					Configure from top to bottom. Media management and delay profiles must be saved before
					quality profiles can be synced. Quality profiles depend on these settings to ensure your
					instance is configured consistently.
				</p>
			</div>

			<div class="border-t border-neutral-200 pt-4 dark:border-neutral-700">
				<div class="mb-3 font-medium text-neutral-900 dark:text-neutral-100">Sync Methods</div>

				<div class="space-y-3">
					<div>
						<div class="font-medium text-neutral-800 dark:text-neutral-200">Manual</div>
						<p class="mt-0.5">
							You manually click the sync button. Useful for media management settings that rarely
							get updates.
						</p>
					</div>

					<div>
						<div class="font-medium text-neutral-800 dark:text-neutral-200">Schedule</div>
						<p class="mt-0.5">Syncs on a defined schedule using cron expressions.</p>
					</div>

					<div>
						<div class="font-medium text-neutral-800 dark:text-neutral-200">On Pull</div>
						<p class="mt-0.5">
							Syncs when the upstream database gets a change (when you pull from remote).
						</p>
					</div>

					<div>
						<div class="font-medium text-neutral-800 dark:text-neutral-200">On Change</div>
						<p class="mt-0.5">
							Syncs when anything changes - whether you pull from upstream or change something
							yourself.
						</p>
					</div>
				</div>
			</div>

			<div class="border-t border-neutral-200 pt-4 dark:border-neutral-700">
				<div class="mb-3 font-medium text-neutral-900 dark:text-neutral-100">Cron Expressions</div>
				<p class="mb-3">
					Schedule uses standard cron syntax: <code
						class="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs dark:bg-neutral-800"
						>minute hour day month weekday</code
					>
				</p>
				<div class="space-y-1.5 font-mono text-xs">
					<div class="flex gap-3">
						<code class="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">0 * * * *</code>
						<span class="font-sans">Every hour</span>
					</div>
					<div class="flex gap-3">
						<code class="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800"
							>*/15 * * * *</code
						>
						<span class="font-sans">Every 15 minutes</span>
					</div>
					<div class="flex gap-3">
						<code class="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">0 0 * * *</code>
						<span class="font-sans">Daily at midnight</span>
					</div>
					<div class="flex gap-3">
						<code class="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">0 6 * * 1</code>
						<span class="font-sans">Every Monday at 6am</span>
					</div>
				</div>
			</div>
		</div>
	</InfoModal>

	<DirtyModal />
{/key}
