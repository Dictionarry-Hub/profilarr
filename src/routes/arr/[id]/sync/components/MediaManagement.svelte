<script lang="ts">
	import DropdownCombobox from '$ui/dropdown/DropdownCombobox.svelte';
	import SyncFooter from './SyncFooter.svelte';
	import ProgressIndicator from '$ui/arr/ProgressIndicator.svelte';
	import { alertStore } from '$lib/client/alerts/store.ts';
	import { deserialize } from '$app/forms';
	import { jobStatus } from '$stores/jobStatus';

	interface ConfigOption {
		name: string;
	}

	interface Database {
		id: number;
		name: string;
		namingConfigs: ConfigOption[];
		qualityDefinitionsConfigs: ConfigOption[];
		mediaSettingsConfigs: ConfigOption[];
	}

	interface SectionProgress {
		total: number;
		drifted: number;
		message?: string;
	}

	export let databases: Database[];
	export let state: {
		namingDatabaseId: number | null;
		namingConfigName: string | null;
		qualityDefinitionsDatabaseId: number | null;
		qualityDefinitionsConfigName: string | null;
		mediaSettingsDatabaseId: number | null;
		mediaSettingsConfigName: string | null;
	} = {
		namingDatabaseId: null,
		namingConfigName: null,
		qualityDefinitionsDatabaseId: null,
		qualityDefinitionsConfigName: null,
		mediaSettingsDatabaseId: null,
		mediaSettingsConfigName: null
	};
	export let namingProgress: SectionProgress | undefined = undefined;
	export let qualityDefinitionsProgress: SectionProgress | undefined = undefined;
	export let mediaSettingsProgress: SectionProgress | undefined = undefined;

	type SelectionOption = {
		value: string;
		label: string;
	};

	function getNamingOptions(): SelectionOption[] {
		const options: SelectionOption[] = [];
		for (const db of databases) {
			for (const config of db.namingConfigs) {
				options.push({
					value: JSON.stringify([db.id, config.name]),
					label: `${db.name} / ${config.name}`
				});
			}
		}
		return options;
	}

	function getQualityDefinitionsOptions(): SelectionOption[] {
		const options: SelectionOption[] = [];
		for (const db of databases) {
			for (const config of db.qualityDefinitionsConfigs) {
				options.push({
					value: JSON.stringify([db.id, config.name]),
					label: `${db.name} / ${config.name}`
				});
			}
		}
		return options;
	}

	function getMediaSettingsOptions(): SelectionOption[] {
		const options: SelectionOption[] = [];
		for (const db of databases) {
			for (const config of db.mediaSettingsConfigs) {
				options.push({
					value: JSON.stringify([db.id, config.name]),
					label: `${db.name} / ${config.name}`
				});
			}
		}
		return options;
	}

	$: namingOptions = getNamingOptions();
	$: qualityDefinitionsOptions = getQualityDefinitionsOptions();
	$: mediaSettingsOptions = getMediaSettingsOptions();

	function parseSelectionValue(value: string): {
		databaseId: number | null;
		configName: string | null;
	} {
		if (!value) return { databaseId: null, configName: null };
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed) && parsed.length === 2) {
				const databaseId = Number(parsed[0]);
				const configName = String(parsed[1]);
				if (!Number.isNaN(databaseId) && configName) {
					return { databaseId, configName };
				}
			}
		} catch {
			// Ignore malformed values and clear selection.
		}
		return { databaseId: null, configName: null };
	}

	$: namingValue =
		state.namingDatabaseId !== null && state.namingConfigName
			? JSON.stringify([state.namingDatabaseId, state.namingConfigName])
			: '';
	$: qualityDefinitionsValue =
		state.qualityDefinitionsDatabaseId !== null && state.qualityDefinitionsConfigName
			? JSON.stringify([state.qualityDefinitionsDatabaseId, state.qualityDefinitionsConfigName])
			: '';
	$: mediaSettingsValue =
		state.mediaSettingsDatabaseId !== null && state.mediaSettingsConfigName
			? JSON.stringify([state.mediaSettingsDatabaseId, state.mediaSettingsConfigName])
			: '';

	function selectNaming(value: string) {
		const parsed = parseSelectionValue(value);
		state = {
			...state,
			namingDatabaseId: parsed.databaseId,
			namingConfigName: parsed.configName
		};
	}

	function selectQuality(value: string) {
		const parsed = parseSelectionValue(value);
		state = {
			...state,
			qualityDefinitionsDatabaseId: parsed.databaseId,
			qualityDefinitionsConfigName: parsed.configName
		};
	}

	function selectMedia(value: string) {
		const parsed = parseSelectionValue(value);
		state = {
			...state,
			mediaSettingsDatabaseId: parsed.databaseId,
			mediaSettingsConfigName: parsed.configName
		};
	}

	export let syncTrigger: 'manual' | 'on_pull' | 'schedule' = 'manual';
	export let cronExpression: string = '0 * * * *';

	let saving = false;
	let syncing = false;

	// Track saved state for dirty detection
	let savedState = JSON.stringify({ state, syncTrigger, cronExpression });
	$: currentState = JSON.stringify({ state, syncTrigger, cronExpression });
	export let isDirty = false;
	$: isDirty = currentState !== savedState;

	async function handleSave() {
		saving = true;
		try {
			const formData = new FormData();
			formData.set('namingDatabaseId', state.namingDatabaseId?.toString() ?? '');
			formData.set('namingConfigName', state.namingConfigName ?? '');
			formData.set(
				'qualityDefinitionsDatabaseId',
				state.qualityDefinitionsDatabaseId?.toString() ?? ''
			);
			formData.set('qualityDefinitionsConfigName', state.qualityDefinitionsConfigName ?? '');
			formData.set('mediaSettingsDatabaseId', state.mediaSettingsDatabaseId?.toString() ?? '');
			formData.set('mediaSettingsConfigName', state.mediaSettingsConfigName ?? '');
			formData.set('trigger', syncTrigger);
			formData.set('cron', cronExpression);

			const response = await fetch('?/saveMediaManagement', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				alertStore.add('success', 'Media management sync config saved');
				// Update saved state to current
				savedState = JSON.stringify({ state, syncTrigger, cronExpression });
			} else {
				alertStore.add('error', 'Failed to save media management sync config');
			}
		} catch {
			alertStore.add('error', 'Failed to save media management sync config');
		} finally {
			saving = false;
		}
	}

	async function handleSync() {
		jobStatus.connect();
		syncing = true;
		try {
			const response = await fetch('?/syncMediaManagement', {
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

<div data-onboarding="sync-media-management" class="rounded-card border border-border bg-surface">
	<!-- Header -->
	<div
		class="flex flex-col gap-4 border-b border-border px-6 py-4 md:flex-row md:items-start md:justify-between md:gap-6"
	>
		<div class="min-w-0 md:flex-1">
			<h2 class="text-xl font-semibold text-text">Media Management</h2>
			<p class="mt-1 text-sm text-text-soft">
				Select which database config to use for each media management setting
			</p>
		</div>
		{#if namingProgress || qualityDefinitionsProgress || mediaSettingsProgress}
			<div class="flex flex-col gap-3 md:flex-shrink-0 md:flex-row md:flex-wrap md:gap-5 md:pt-1">
				{#if namingProgress}
					<div class="min-w-[9rem]">
						<div class="mb-1 text-xs font-medium text-text-muted">Naming</div>
						<ProgressIndicator
							current={namingProgress.total - namingProgress.drifted}
							target={namingProgress.total}
							met={namingProgress.drifted === 0}
							mode="compact"
							colorMode="completion"
							tooltip={namingProgress.message ?? ''}
							tooltipPosition="bottom"
							tooltipAlign="middle"
						/>
					</div>
				{/if}
				{#if qualityDefinitionsProgress}
					<div class="min-w-[9rem]">
						<div class="mb-1 text-xs font-medium text-text-muted">Quality Definitions</div>
						<ProgressIndicator
							current={qualityDefinitionsProgress.total - qualityDefinitionsProgress.drifted}
							target={qualityDefinitionsProgress.total}
							met={qualityDefinitionsProgress.drifted === 0}
							mode="compact"
							colorMode="completion"
							tooltip={qualityDefinitionsProgress.message ?? ''}
							tooltipPosition="bottom"
							tooltipAlign="middle"
						/>
					</div>
				{/if}
				{#if mediaSettingsProgress}
					<div class="min-w-[9rem]">
						<div class="mb-1 text-xs font-medium text-text-muted">Media Settings</div>
						<ProgressIndicator
							current={mediaSettingsProgress.total - mediaSettingsProgress.drifted}
							target={mediaSettingsProgress.total}
							met={mediaSettingsProgress.drifted === 0}
							mode="compact"
							colorMode="completion"
							tooltip={mediaSettingsProgress.message ?? ''}
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
		<div class="grid gap-6 sm:grid-cols-3">
			<!-- Naming -->
			<div class="space-y-2">
				<div class="space-y-1">
					<div class="text-sm font-medium text-text">Naming</div>
					<p class="text-xs text-text-soft">Choose the naming config to sync.</p>
				</div>
				<DropdownCombobox
					fullWidth
					minWidth="0"
					dropdownWidth="100%"
					limit={6}
					clearable
					options={namingOptions}
					value={namingValue}
					placeholder={namingOptions.length === 0
						? 'No naming configs available'
						: 'Select naming config...'}
					disabled={namingOptions.length === 0}
					on:change={(e) => selectNaming(e.detail)}
				/>
			</div>

			<!-- Quality Definitions -->
			<div class="space-y-2">
				<div class="space-y-1">
					<div class="text-sm font-medium text-text">Quality Definitions</div>
					<p class="text-xs text-text-soft">Choose the quality definitions config to sync.</p>
				</div>
				<DropdownCombobox
					fullWidth
					minWidth="0"
					dropdownWidth="100%"
					limit={6}
					clearable
					options={qualityDefinitionsOptions}
					value={qualityDefinitionsValue}
					placeholder={qualityDefinitionsOptions.length === 0
						? 'No quality definitions configs available'
						: 'Select quality definitions config...'}
					disabled={qualityDefinitionsOptions.length === 0}
					on:change={(e) => selectQuality(e.detail)}
				/>
			</div>

			<!-- Media Settings -->
			<div class="space-y-2">
				<div class="space-y-1">
					<div class="text-sm font-medium text-text">Media Settings</div>
					<p class="text-xs text-text-soft">Choose the media settings config to sync.</p>
				</div>
				<DropdownCombobox
					fullWidth
					minWidth="0"
					dropdownWidth="100%"
					limit={6}
					clearable
					options={mediaSettingsOptions}
					value={mediaSettingsValue}
					placeholder={mediaSettingsOptions.length === 0
						? 'No media settings configs available'
						: 'Select media settings config...'}
					disabled={mediaSettingsOptions.length === 0}
					on:change={(e) => selectMedia(e.detail)}
				/>
			</div>
		</div>
	</div>

	<SyncFooter
		bind:syncTrigger
		bind:cronExpression
		{saving}
		{syncing}
		{isDirty}
		hasConfig={state.namingDatabaseId !== null ||
			state.qualityDefinitionsDatabaseId !== null ||
			state.mediaSettingsDatabaseId !== null}
		onboardingId="sync-trigger"
		onWarning={(msg) => alertStore.add('warning', msg)}
		on:save={handleSave}
		on:sync={handleSync}
	/>
</div>
