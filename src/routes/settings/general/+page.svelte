<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { enhance } from '$app/forms';
	import { alertStore } from '$alerts/store';
	import { navIconStore, type NavIconStyle } from '$stores/navIcons';
	import { alertSettingsStore, type AlertPosition, DEFAULT_ALERT_SETTINGS } from '$alerts/settings';
	import { initEdit, update, isDirty, resetFromServer, clear } from '$stores/dirty';
	import { FEATURES } from '$shared/features.ts';
	import {
		Save,
		Loader2,
		RotateCcw,
		FlaskConical,
		Eye,
		EyeOff,
		CheckCircle,
		XCircle,
		AlertTriangle,
		Info
	} from 'lucide-svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Card from '$ui/card/Card.svelte';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import Button from '$ui/button/Button.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	let saving = false;

	// --- Local state (initialized from server data / client stores) ---

	// Logging
	let logEnabled = data.logSettings.enabled;
	let logFileLogging = data.logSettings.file_logging;
	let logConsoleLogging = data.logSettings.console_logging;
	let logMinLevel = data.logSettings.min_level;
	let logRetentionDays: number | undefined = data.logSettings.retention_days;

	// Backup
	let backupEnabled = data.backupSettings.enabled;
	let backupSchedule = data.backupSettings.schedule;
	let backupRetentionDays: number | undefined = data.backupSettings.retention_days;

	// AI (feature-flagged)
	let aiEnabled = data.aiSettings.enabled;
	let aiApiUrl = data.aiSettings.api_url;
	let aiApiKey = '';
	let aiModel = data.aiSettings.model;

	// TMDB
	let tmdbApiKey = '';
	let tmdbShowKey = false;
	let tmdbTesting = false;

	// Arr defaults
	let arrApplyDefaultDelayProfiles = data.generalSettings.apply_default_delay_profiles;

	// UI (client-side stores)
	let uiNavIconStyle: NavIconStyle = 'lucide';
	let uiAlertPosition: AlertPosition = DEFAULT_ALERT_SETTINGS.position;
	let uiAlertDurationSeconds: number | undefined = Math.round(
		DEFAULT_ALERT_SETTINGS.durationMs / 1000
	);

	// AI show/hide API key
	let aiShowKey = false;

	// --- Dropdown options ---

	const logLevelOptions = [
		{ value: 'DEBUG', label: 'DEBUG — All logs including debug information' },
		{ value: 'INFO', label: 'INFO — Informational messages and above' },
		{ value: 'WARN', label: 'WARN — Warnings and errors only' },
		{ value: 'ERROR', label: 'ERROR — Errors only' }
	];

	const backupScheduleOptions = [
		{ value: 'daily', label: 'Daily' },
		{ value: 'weekly', label: 'Weekly' },
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'hourly', label: 'Hourly' },
		{ value: '*/6 hours', label: 'Every 6 hours' },
		{ value: '*/12 hours', label: 'Every 12 hours' }
	];

	const alertPositionOptions = [
		{ value: 'top-left', label: 'Top left' },
		{ value: 'top-center', label: 'Top center' },
		{ value: 'top-right', label: 'Top right' },
		{ value: 'bottom-left', label: 'Bottom left' },
		{ value: 'bottom-center', label: 'Bottom center' },
		{ value: 'bottom-right', label: 'Bottom right' }
	];

	// --- Logging defaults ---

	const LOG_DEFAULTS = {
		enabled: true,
		file_logging: true,
		console_logging: true,
		min_level: 'INFO' as const,
		retention_days: 30
	};

	// --- AI defaults ---

	const AI_DEFAULTS = {
		enabled: false,
		api_url: 'https://api.openai.com/v1',
		api_key: '',
		model: 'gpt-4o-mini'
	};

	// --- TMDB defaults ---

	const TMDB_DEFAULTS = {
		api_key: ''
	};

	// --- Dirty tracking ---

	function buildSnapshot() {
		const snapshot: Record<string, unknown> = {
			log_enabled: logEnabled,
			log_file_logging: logFileLogging,
			log_console_logging: logConsoleLogging,
			log_min_level: logMinLevel,
			log_retention_days: logRetentionDays,
			backup_enabled: backupEnabled,
			backup_schedule: backupSchedule,
			backup_retention_days: backupRetentionDays,
			tmdb_api_key: tmdbApiKey,
			arr_apply_default_delay_profiles: arrApplyDefaultDelayProfiles,
			ui_nav_icon_style: uiNavIconStyle,
			ui_alert_position: uiAlertPosition,
			ui_alert_duration_seconds: uiAlertDurationSeconds
		};

		if (FEATURES.ai) {
			snapshot.ai_enabled = aiEnabled;
			snapshot.ai_api_url = aiApiUrl;
			snapshot.ai_api_key = aiApiKey;
			snapshot.ai_model = aiModel;
		}

		return snapshot;
	}

	onMount(() => {
		// Read UI stores
		uiNavIconStyle = get(navIconStore);
		const alertSettings = get(alertSettingsStore);
		uiAlertPosition = alertSettings.position;
		uiAlertDurationSeconds = Math.round(alertSettings.durationMs / 1000);

		initEdit(buildSnapshot());

		return () => clear();
	});

	// --- Reset helpers ---

	function resetLoggingDefaults() {
		logEnabled = LOG_DEFAULTS.enabled;
		logFileLogging = LOG_DEFAULTS.file_logging;
		logConsoleLogging = LOG_DEFAULTS.console_logging;
		logMinLevel = LOG_DEFAULTS.min_level;
		logRetentionDays = LOG_DEFAULTS.retention_days;
		update('log_enabled', logEnabled);
		update('log_file_logging', logFileLogging);
		update('log_console_logging', logConsoleLogging);
		update('log_min_level', logMinLevel);
		update('log_retention_days', logRetentionDays);
	}

	function resetAIDefaults() {
		aiEnabled = AI_DEFAULTS.enabled;
		aiApiUrl = AI_DEFAULTS.api_url;
		aiApiKey = AI_DEFAULTS.api_key;
		aiModel = AI_DEFAULTS.model;
		update('ai_enabled', aiEnabled);
		update('ai_api_url', aiApiUrl);
		update('ai_api_key', aiApiKey);
		update('ai_model', aiModel);
	}

	function resetTMDBDefaults() {
		tmdbApiKey = TMDB_DEFAULTS.api_key;
		update('tmdb_api_key', tmdbApiKey);
	}

	// --- TMDB test ---

	async function testTMDBConnection() {
		if (!tmdbApiKey && !data.tmdbSettings.hasApiKey) {
			alertStore.add('error', 'Please enter an API key first');
			return;
		}

		tmdbTesting = true;
		try {
			const response = await fetch('/api/tmdb/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ apiKey: tmdbApiKey })
			});
			const result = await response.json();

			if (result.success) {
				alertStore.add('success', 'TMDB connection successful!');
			} else {
				alertStore.add('error', result.error || 'Connection failed');
			}
		} catch {
			alertStore.add('error', 'Failed to test connection');
		} finally {
			tmdbTesting = false;
		}
	}
</script>

<form
	id="general-settings-form"
	method="POST"
	action="?/save"
	use:enhance={() => {
		saving = true;
		return async ({ result, update: formUpdate }) => {
			if (result.type === 'failure' && result.data) {
				alertStore.add('error', (result.data as { error?: string }).error || 'Failed to save');
			} else if (result.type === 'success') {
				// Save UI stores (client-side only)
				const durationMs = Math.max(0, Math.round((uiAlertDurationSeconds ?? 0) * 1000));
				navIconStore.setStyle(uiNavIconStyle);
				alertSettingsStore.setSettings({ position: uiAlertPosition, durationMs });

				// Reset dirty tracking
				resetFromServer(buildSnapshot());
				alertStore.add('success', 'Settings saved successfully!');
			}
			saving = false;
			await formUpdate({ reset: false });
		};
	}}
>
	<div class="p-4 md:p-8">
		<StickyCard position="top">
			<div slot="left">
				<h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
					General Settings
				</h1>
				<p class="text-sm text-neutral-500 dark:text-neutral-400">
					Configure general application settings and preferences
				</p>
			</div>
			<div slot="right">
				<Button
					text={saving ? 'Saving...' : 'Save'}
					icon={saving ? Loader2 : Save}
					iconColor="text-blue-600 dark:text-blue-400"
					loading={saving}
					disabled={saving || !$isDirty}
					type="submit"
				/>
			</div>
		</StickyCard>

		<div class="mt-6">
			<CardGrid columns={1} gap="md" flush>
				<!-- ==================== Interface (UI) ==================== -->
				<Card>
					<svelte:fragment slot="header">
						<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Interface</h2>
						<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
							Customize the look and feel of the application
						</p>
					</svelte:fragment>

					<div class="space-y-4">
						<Toggle
							label="Use Emojis"
							checked={uiNavIconStyle === 'emoji'}
							on:change={(e) => {
								uiNavIconStyle = e.detail ? 'emoji' : 'lucide';
								update('ui_nav_icon_style', uiNavIconStyle);
							}}
						/>

						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<span class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50">
									Alert Position
								</span>
								<DropdownSelect
									value={uiAlertPosition}
									options={alertPositionOptions}
									fullWidth
									fixed
									on:change={(e) => {
										uiAlertPosition = e.detail as AlertPosition;
										update('ui_alert_position', uiAlertPosition);
									}}
								/>
								<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
									On mobile, only top or bottom applies.
								</p>
							</div>

							<div>
								<label
									for="ui_alert_duration"
									class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50"
								>
									Alert Duration
								</label>
								<NumberInput
									name="ui_alert_duration"
									id="ui_alert_duration"
									value={uiAlertDurationSeconds}
									min={0}
									step={1}
									onchange={(v) => {
										uiAlertDurationSeconds = v;
										update('ui_alert_duration_seconds', v);
									}}
								/>
								<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
									In seconds. Set to 0 to keep until dismissed.
								</p>
							</div>
						</div>

						<!-- Test Alerts -->
						<div
							class="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-700"
						>
							<span
								class="text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
							>
								Test
							</span>
							<Button
								text="Success"
								icon={CheckCircle}
								iconColor="text-green-600 dark:text-green-400"
								size="sm"
								on:click={() => alertStore.add('success', 'Success alert example.')}
							/>
							<Button
								text="Error"
								icon={XCircle}
								iconColor="text-red-600 dark:text-red-400"
								size="sm"
								on:click={() => alertStore.add('error', 'Error alert example.')}
							/>
							<Button
								text="Warning"
								icon={AlertTriangle}
								iconColor="text-yellow-500 dark:text-yellow-400"
								size="sm"
								on:click={() => alertStore.add('warning', 'Warning alert example.')}
							/>
							<Button
								text="Info"
								icon={Info}
								iconColor="text-blue-600 dark:text-blue-400"
								size="sm"
								on:click={() => alertStore.add('info', 'Info alert example.')}
							/>
						</div>
					</div>
				</Card>

				<!-- ==================== Arr Instance Defaults ==================== -->
				<Card>
					<svelte:fragment slot="header">
						<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
							Arr Instance Defaults
						</h2>
						<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
							Configure default settings applied when adding new Radarr/Sonarr instances
						</p>
					</svelte:fragment>

					<div class="space-y-4">
						<Toggle
							label="Apply Default Delay Profile"
							checked={arrApplyDefaultDelayProfiles}
							on:change={(e) => {
								arrApplyDefaultDelayProfiles = e.detail;
								update('arr_apply_default_delay_profiles', e.detail);
							}}
						/>
						<input
							type="hidden"
							name="arr_apply_default_delay_profiles"
							value={arrApplyDefaultDelayProfiles ? 'on' : ''}
						/>
						<p class="text-xs text-neutral-500 dark:text-neutral-400">
							Automatically configure the default delay profile when adding new arr instances
						</p>
					</div>
				</Card>

				<!-- ==================== Backup Configuration ==================== -->
				<Card>
					<svelte:fragment slot="header">
						<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Backups</h2>
						<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
							Configure automatic backups, schedule, and retention policy
						</p>
					</svelte:fragment>

					<div class="space-y-4">
						<Toggle
							label="Enable Automatic Backups"
							checked={backupEnabled}
							on:change={(e) => {
								backupEnabled = e.detail;
								update('backup_enabled', e.detail);
							}}
						/>
						<input type="hidden" name="backup_enabled" value={backupEnabled ? 'on' : ''} />

						{#if backupEnabled}
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div>
									<span
										class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50"
									>
										Schedule
									</span>
									<DropdownSelect
										value={backupSchedule}
										options={backupScheduleOptions}
										fullWidth
										fixed
										on:change={(e) => {
											backupSchedule = e.detail;
											update('backup_schedule', e.detail);
										}}
									/>
									<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
										How often to create automatic backups
									</p>
								</div>

								<div>
									<label
										for="backup_retention_days"
										class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50"
									>
										Retention Period
									</label>
									<NumberInput
										name="backup_retention_days"
										id="backup_retention_days"
										value={backupRetentionDays}
										min={1}
										max={365}
										onchange={(v) => {
											backupRetentionDays = v;
											update('backup_retention_days', v);
										}}
									/>
									<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
										In days. Delete backups older than this.
									</p>
								</div>
							</div>
						{/if}
						<input type="hidden" name="backup_schedule" value={backupSchedule} />
					</div>
				</Card>

				<!-- ==================== Logging Configuration ==================== -->
				<Card>
					<svelte:fragment slot="header">
						<div class="flex items-center justify-between">
							<div>
								<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Logging</h2>
								<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
									Configure application logs, rotation, and retention
								</p>
							</div>
							<Button text="Reset" icon={RotateCcw} size="xs" on:click={resetLoggingDefaults} />
						</div>
					</svelte:fragment>

					<div class="space-y-4">
						<Toggle
							label="Enable Logging"
							checked={logEnabled}
							on:change={(e) => {
								logEnabled = e.detail;
								update('log_enabled', e.detail);
							}}
						/>
						<input type="hidden" name="log_enabled" value={logEnabled ? 'on' : ''} />

						{#if logEnabled}
							<Toggle
								label="File Logging"
								checked={logFileLogging}
								on:change={(e) => {
									logFileLogging = e.detail;
									update('log_file_logging', e.detail);
								}}
							/>

							<Toggle
								label="Console Logging"
								checked={logConsoleLogging}
								on:change={(e) => {
									logConsoleLogging = e.detail;
									update('log_console_logging', e.detail);
								}}
							/>

							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div>
									<span
										class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50"
									>
										Minimum Level
									</span>
									<DropdownSelect
										value={logMinLevel}
										options={logLevelOptions}
										fullWidth
										fixed
										on:change={(e) => {
											logMinLevel = e.detail as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
											update('log_min_level', logMinLevel);
										}}
									/>
									<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
										Only log at or above this level
									</p>
								</div>

								<div>
									<label
										for="log_retention_days"
										class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50"
									>
										Retention Period
									</label>
									<NumberInput
										name="log_retention_days"
										id="log_retention_days"
										value={logRetentionDays}
										min={1}
										max={365}
										onchange={(v) => {
											logRetentionDays = v;
											update('log_retention_days', v);
										}}
									/>
									<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
										In days. Logs rotate daily (YYYY-MM-DD.log).
									</p>
								</div>
							</div>
						{/if}
						<input type="hidden" name="log_file_logging" value={logFileLogging ? 'on' : ''} />
						<input type="hidden" name="log_console_logging" value={logConsoleLogging ? 'on' : ''} />
						<input type="hidden" name="log_min_level" value={logMinLevel} />
					</div>
				</Card>

				<!-- ==================== TMDB Configuration ==================== -->
				<Card>
					<svelte:fragment slot="header">
						<div class="flex items-center justify-between">
							<div>
								<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
									TMDB Configuration
								</h2>
								<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
									Configure TMDB API access for searching movies and TV series
								</p>
							</div>
							<div class="flex items-center gap-2">
								<Button
									text="Test"
									icon={tmdbTesting ? Loader2 : FlaskConical}
									loading={tmdbTesting}
									disabled={tmdbTesting}
									size="xs"
									on:click={testTMDBConnection}
								/>
								<Button text="Reset" icon={RotateCcw} size="xs" on:click={resetTMDBDefaults} />
							</div>
						</div>
					</svelte:fragment>

					<div class="space-y-4">
						<div class="relative">
							<FormInput
								label="API Read Access Token"
								name="tmdb_api_key"
								value={tmdbApiKey}
								type={tmdbShowKey ? 'text' : 'password'}
								mono
								placeholder={data.tmdbSettings.hasApiKey ? '••••••••••••••••' : ''}
								description={data.tmdbSettings.hasApiKey
									? 'Leave blank to keep existing key'
									: 'Use the API Read Access Token (not API Key) from themoviedb.org'}
								on:input={(e) => {
									tmdbApiKey = e.detail;
									update('tmdb_api_key', e.detail);
								}}
							>
								<button
									slot="suffix"
									type="button"
									on:click={() => (tmdbShowKey = !tmdbShowKey)}
									class="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
								>
									{#if tmdbShowKey}
										<EyeOff size={16} />
									{:else}
										<Eye size={16} />
									{/if}
								</button>
							</FormInput>
						</div>
					</div>
				</Card>

				<!-- ==================== AI Configuration (feature-flagged) ==================== -->
				{#if FEATURES.ai}
					<Card>
						<svelte:fragment slot="header">
							<div class="flex items-center justify-between">
								<div>
									<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
										AI Configuration
									</h2>
									<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
										Configure AI-powered features. Works with OpenAI, Ollama, LM Studio, or any
										OpenAI-compatible API.
									</p>
								</div>
								<Button text="Reset" icon={RotateCcw} size="xs" on:click={resetAIDefaults} />
							</div>
						</svelte:fragment>

						<div class="space-y-4">
							<Toggle
								label="Enable AI Features"
								checked={aiEnabled}
								on:change={(e) => {
									aiEnabled = e.detail;
									update('ai_enabled', e.detail);
								}}
							/>
							<input type="hidden" name="ai_enabled" value={aiEnabled ? 'on' : ''} />

							{#if aiEnabled}
								<FormInput
									label="API URL"
									name="ai_api_url"
									value={aiApiUrl}
									type="url"
									mono
									description="OpenAI-compatible endpoint (e.g., Ollama: http://localhost:11434/v1)"
									on:input={(e) => {
										aiApiUrl = e.detail;
										update('ai_api_url', e.detail);
									}}
								/>

								<FormInput
									label="API Key"
									name="ai_api_key"
									value={aiApiKey}
									type={aiShowKey ? 'text' : 'password'}
									mono
									placeholder={data.aiSettings.hasApiKey ? '••••••••••••••••' : ''}
									description={data.aiSettings.hasApiKey
										? 'Leave blank to keep existing key'
										: 'Required for cloud providers. Leave empty for local APIs.'}
									on:input={(e) => {
										aiApiKey = e.detail;
										update('ai_api_key', e.detail);
									}}
								>
									<button
										slot="suffix"
										type="button"
										on:click={() => (aiShowKey = !aiShowKey)}
										class="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
									>
										{#if aiShowKey}
											<EyeOff size={16} />
										{:else}
											<Eye size={16} />
										{/if}
									</button>
								</FormInput>

								<FormInput
									label="Model"
									name="ai_model"
									value={aiModel}
									mono
									description="e.g., gpt-4o-mini, llama3.2, claude-3-haiku"
									on:input={(e) => {
										aiModel = e.detail;
										update('ai_model', e.detail);
									}}
								/>
							{/if}
						</div>
					</Card>
				{/if}
			</CardGrid>
		</div>
	</div>
</form>
