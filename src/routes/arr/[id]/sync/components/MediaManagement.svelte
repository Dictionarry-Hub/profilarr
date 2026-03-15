<script lang="ts">
	import SearchDropdown from '$ui/form/SearchDropdown.svelte';
	import SyncFooter from './SyncFooter.svelte';
	import { alertStore } from '$lib/client/alerts/store.ts';
	import { deserialize } from '$app/forms';

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

<div
	class="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
>
	<!-- Header -->
	<div class="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
		<h2 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Media Management</h2>
		<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
			Select which database config to use for each media management setting
		</p>
	</div>

	<!-- Content -->
	<div class="p-6">
		<div class="grid gap-6 sm:grid-cols-3">
			<!-- Naming -->
			<SearchDropdown
				label="Naming"
				hideLabel={false}
				fullWidth
				options={namingOptions}
				value={namingValue}
				placeholder={namingOptions.length === 0
					? 'No naming configs available'
					: 'Select naming config...'}
				disabled={namingOptions.length === 0}
				description="Choose the naming config to sync. Clear to unset."
				on:change={(e) => selectNaming(e.detail)}
			/>

			<!-- Quality Definitions -->
			<SearchDropdown
				label="Quality Definitions"
				hideLabel={false}
				fullWidth
				options={qualityDefinitionsOptions}
				value={qualityDefinitionsValue}
				placeholder={qualityDefinitionsOptions.length === 0
					? 'No quality definitions configs available'
					: 'Select quality definitions config...'}
				disabled={qualityDefinitionsOptions.length === 0}
				description="Choose the quality definitions config to sync. Clear to unset."
				on:change={(e) => selectQuality(e.detail)}
			/>

			<!-- Media Settings -->
			<SearchDropdown
				label="Media Settings"
				hideLabel={false}
				fullWidth
				options={mediaSettingsOptions}
				value={mediaSettingsValue}
				placeholder={mediaSettingsOptions.length === 0
					? 'No media settings configs available'
					: 'Select media settings config...'}
				disabled={mediaSettingsOptions.length === 0}
				description="Choose the media settings config to sync. Clear to unset."
				on:change={(e) => selectMedia(e.detail)}
			/>
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
		onWarning={(msg) => alertStore.add('warning', msg)}
		on:save={handleSave}
		on:sync={handleSync}
	/>
</div>
