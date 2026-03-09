<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { enhance } from '$app/forms';
	import { alertStore } from '$alerts/store';
	import { navIconStore, type NavIconStyle } from '$stores/navIcons';
	import { alertSettingsStore, type AlertPosition, DEFAULT_ALERT_SETTINGS } from '$alerts/settings';
	import {
		fontStore,
		sansFontOptions,
		monoFontOptions,
		type SansFont,
		type MonoFont
	} from '$stores/font';
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
	import ExpandableCard from '$ui/card/ExpandableCard.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
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
	let uiFontSans: SansFont = 'dm-sans';
	let uiFontMono: MonoFont = 'geist-mono';

	// AI show/hide API key
	let aiShowKey = false;

	// --- Dropdown options ---

	const logLevelOptions = [
		{ value: 'DEBUG', label: 'DEBUG' },
		{ value: 'INFO', label: 'INFO' },
		{ value: 'WARN', label: 'WARN' },
		{ value: 'ERROR', label: 'ERROR' }
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
			ui_alert_duration_seconds: uiAlertDurationSeconds,
			ui_font_sans: uiFontSans,
			ui_font_mono: uiFontMono
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
		const fontSettings = get(fontStore);
		uiFontSans = fontSettings.sans;
		uiFontMono = fontSettings.mono;

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
			const response = await fetch('/tmdb/validate', {
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
				fontStore.setFonts({ sans: uiFontSans, mono: uiFontMono });

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
		<div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold text-neutral-900 md:text-3xl dark:text-neutral-50">
					General Settings
				</h1>
				<p class="mt-2 text-base text-neutral-600 md:mt-3 md:text-lg dark:text-neutral-400">
					Configure general application settings and preferences
				</p>
			</div>
			<Button
				text={saving ? 'Saving...' : 'Save'}
				icon={saving ? Loader2 : Save}
				iconColor="text-blue-600 dark:text-blue-400"
				loading={saving}
				disabled={saving || !$isDirty}
				type="submit"
			/>
		</div>

		<div class="space-y-6">
			<!-- ==================== Interface (UI) ==================== -->
			<ExpandableCard
				title="Interface"
				description="Customize the look and feel of the application"
			>
				<svelte:fragment slot="header-right">
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<div class="flex items-center gap-1" on:click|stopPropagation>
						<Button
							icon={CheckCircle}
							iconColor="text-green-600 dark:text-green-400"
							size="xs"
							on:click={() => alertStore.add('success', 'Success alert example.')}
						/>
						<Button
							icon={XCircle}
							iconColor="text-red-600 dark:text-red-400"
							size="xs"
							on:click={() => alertStore.add('error', 'Error alert example.')}
						/>
						<Button
							icon={AlertTriangle}
							iconColor="text-yellow-500 dark:text-yellow-400"
							size="xs"
							on:click={() => alertStore.add('warning', 'Warning alert example.')}
						/>
						<Button
							icon={Info}
							iconColor="text-blue-600 dark:text-blue-400"
							size="xs"
							on:click={() => alertStore.add('info', 'Info alert example.')}
						/>
					</div>
				</svelte:fragment>
				<div class="px-6 py-4">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-5">
						<div>
							<span class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50">
								Emoji Icons
							</span>
							<Toggle
								label={uiNavIconStyle === 'emoji' ? 'Enabled' : 'Disabled'}
								checked={uiNavIconStyle === 'emoji'}
								fullWidth
								on:change={(e) => {
									uiNavIconStyle = e.detail ? 'emoji' : 'lucide';
									update('ui_nav_icon_style', uiNavIconStyle);
								}}
							/>
						</div>

						<div class="sm:col-span-2">
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
						</div>

						<div class="sm:col-span-2">
							<label
								for="ui_alert_duration"
								class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50"
							>
								Alert Duration (seconds)
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
						</div>

						<div>
							<span class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50">
								Sans Font
							</span>
							<DropdownSelect
								value={uiFontSans}
								options={sansFontOptions}
								fullWidth
								fixed
								on:change={(e) => {
									uiFontSans = e.detail as SansFont;
									update('ui_font_sans', uiFontSans);
								}}
							/>
						</div>

						<div>
							<span class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50">
								Mono Font
							</span>
							<DropdownSelect
								value={uiFontMono}
								options={monoFontOptions}
								fullWidth
								fixed
								on:change={(e) => {
									uiFontMono = e.detail as MonoFont;
									update('ui_font_mono', uiFontMono);
								}}
							/>
						</div>
					</div>
				</div>
			</ExpandableCard>

			<!-- ==================== Arr Instance Defaults ==================== -->
			<ExpandableCard
				title="Arr Instance Defaults"
				description="Configure default settings applied when adding new Radarr/Sonarr instances"
			>
				<div class="px-6 py-4">
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
				</div>
			</ExpandableCard>

			<!-- ==================== Backup Configuration ==================== -->
			<ExpandableCard
				title="Backups"
				description="Configure automatic backups, schedule, and retention policy"
			>
				<div class="grid gap-4 px-6 py-4" class:sm:grid-cols-5={backupEnabled}>
					<div>
						<span class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50">
							Automatic Backups
						</span>
						<Toggle
							label={backupEnabled ? 'Enabled' : 'Disabled'}
							checked={backupEnabled}
							fullWidth={backupEnabled}
							on:change={(e) => {
								backupEnabled = e.detail;
								update('backup_enabled', e.detail);
							}}
						/>
					</div>
					<input type="hidden" name="backup_enabled" value={backupEnabled ? 'on' : ''} />

					{#if backupEnabled}
						<div class="sm:col-span-2">
							<span class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50">
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
						</div>

						<div class="sm:col-span-2">
							<label
								for="backup_retention_days"
								class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50"
							>
								Retention Period (days)
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
						</div>
					{/if}
					<input type="hidden" name="backup_schedule" value={backupSchedule} />
				</div>
			</ExpandableCard>

			<!-- ==================== Logging Configuration ==================== -->
			<ExpandableCard
				title="Logging"
				description="Configure application logs, rotation, and retention"
			>
				<svelte:fragment slot="header-right">
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<div on:click|stopPropagation>
						<Button text="Reset" icon={RotateCcw} size="xs" on:click={resetLoggingDefaults} />
					</div>
				</svelte:fragment>
				<div class="space-y-4 px-6 py-4">
					<div class="grid gap-4" class:sm:grid-cols-7={logEnabled}>
						<div>
							<span class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50">
								Logging
							</span>
							<Toggle
								label={logEnabled ? 'Enabled' : 'Disabled'}
								checked={logEnabled}
								fullWidth={logEnabled}
								on:change={(e) => {
									logEnabled = e.detail;
									update('log_enabled', e.detail);
								}}
							/>
						</div>
						<input type="hidden" name="log_enabled" value={logEnabled ? 'on' : ''} />

						{#if logEnabled}
							<div>
								<span class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50">
									File Logging
								</span>
								<Toggle
									label={logFileLogging ? 'Enabled' : 'Disabled'}
									checked={logFileLogging}
									fullWidth
									on:change={(e) => {
										logFileLogging = e.detail;
										update('log_file_logging', e.detail);
									}}
								/>
							</div>

							<div>
								<span class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50">
									Console Logging
								</span>
								<Toggle
									label={logConsoleLogging ? 'Enabled' : 'Disabled'}
									checked={logConsoleLogging}
									fullWidth
									on:change={(e) => {
										logConsoleLogging = e.detail;
										update('log_console_logging', e.detail);
									}}
								/>
							</div>

							<div class="sm:col-span-2">
								<span class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50">
									Minimum Level
								</span>
								<div class="font-mono">
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
								</div>
							</div>

							<div class="sm:col-span-2">
								<label
									for="log_retention_days"
									class="mb-1 block text-sm font-medium text-neutral-900 dark:text-neutral-50"
								>
									Retention Period (days)
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
							</div>
						{/if}
					</div>
					<input type="hidden" name="log_file_logging" value={logFileLogging ? 'on' : ''} />
					<input type="hidden" name="log_console_logging" value={logConsoleLogging ? 'on' : ''} />
					<input type="hidden" name="log_min_level" value={logMinLevel} />
				</div>
			</ExpandableCard>

			<!-- ==================== TMDB Configuration ==================== -->
			<ExpandableCard
				title="TMDB Configuration"
				description="Configure TMDB API access for searching movies and TV series"
			>
				<svelte:fragment slot="header-right">
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<div class="flex items-center gap-2" on:click|stopPropagation>
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
				</svelte:fragment>
				<div class="space-y-4 px-6 py-4">
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
			</ExpandableCard>

			<!-- ==================== AI Configuration (feature-flagged) ==================== -->
			{#if FEATURES.ai}
				<ExpandableCard
					title="AI Configuration"
					description="Configure AI-powered features. Works with OpenAI, Ollama, LM Studio, or any OpenAI-compatible API."
				>
					<svelte:fragment slot="header-right">
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<div on:click|stopPropagation>
							<Button text="Reset" icon={RotateCcw} size="xs" on:click={resetAIDefaults} />
						</div>
					</svelte:fragment>
					<div class="space-y-4 px-6 py-4">
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
				</ExpandableCard>
			{/if}
		</div>
	</div>

	<DirtyModal />
</form>
