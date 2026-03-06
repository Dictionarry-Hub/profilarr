import type { Actions, RequestEvent } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { logSettingsQueries } from '$db/queries/logSettings.ts';
import { backupSettingsQueries } from '$db/queries/backupSettings.ts';
import { aiSettingsQueries } from '$db/queries/aiSettings.ts';
import { tmdbSettingsQueries } from '$db/queries/tmdbSettings.ts';
import { generalSettingsQueries } from '$db/queries/generalSettings.ts';
import { logSettings } from '$logger/settings.ts';
import { logger } from '$logger/logger.ts';
import { scheduleBackupJobs, scheduleLogCleanup } from '$lib/server/jobs/init.ts';
import { FEATURES } from '$shared/features.ts';

export const load = () => {
	const logSetting = logSettingsQueries.get();
	const backupSetting = backupSettingsQueries.get();
	const tmdbSetting = tmdbSettingsQueries.get();
	const generalSetting = generalSettingsQueries.get();

	if (!logSetting) {
		throw new Error('Log settings not found in database');
	}

	if (!backupSetting) {
		throw new Error('Backup settings not found in database');
	}

	if (!tmdbSetting) {
		throw new Error('TMDB settings not found in database');
	}

	if (!generalSetting) {
		throw new Error('General settings not found in database');
	}

	// AI settings are feature-flagged
	let aiSettings = { enabled: false, api_url: '', hasApiKey: false, model: '' };
	if (FEATURES.ai) {
		const aiSetting = aiSettingsQueries.get();
		if (!aiSetting) {
			throw new Error('AI settings not found in database');
		}
		aiSettings = {
			enabled: aiSetting.enabled === 1,
			api_url: aiSetting.api_url,
			hasApiKey: !!aiSetting.api_key,
			model: aiSetting.model
		};
	}

	return {
		logSettings: {
			retention_days: logSetting.retention_days,
			min_level: logSetting.min_level,
			enabled: logSetting.enabled === 1,
			file_logging: logSetting.file_logging === 1,
			console_logging: logSetting.console_logging === 1
		},
		backupSettings: {
			schedule: backupSetting.schedule,
			retention_days: backupSetting.retention_days,
			enabled: backupSetting.enabled === 1,
			include_database: backupSetting.include_database === 1
		},
		aiSettings,
		tmdbSettings: {
			hasApiKey: !!tmdbSetting.api_key
		},
		generalSettings: {
			apply_default_delay_profiles: generalSetting.apply_default_delay_profiles === 1
		}
	};
};

export const actions: Actions = {
	save: async ({ request }: RequestEvent) => {
		const formData = await request.formData();

		// --- Log settings ---
		const logRetentionDays = parseInt(formData.get('log_retention_days') as string);
		const logMinLevel = formData.get('log_min_level') as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
		const logEnabled = formData.get('log_enabled') === 'on';
		const logFileLogging = formData.get('log_file_logging') === 'on';
		const logConsoleLogging = formData.get('log_console_logging') === 'on';

		if (isNaN(logRetentionDays) || logRetentionDays < 1 || logRetentionDays > 365) {
			return fail(400, { error: 'Log retention days must be between 1 and 365' });
		}

		if (!logMinLevel || !['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(logMinLevel)) {
			return fail(400, { error: 'Invalid minimum log level' });
		}

		// --- Backup settings ---
		const backupSchedule = formData.get('backup_schedule') as string;
		const backupRetentionDays = parseInt(formData.get('backup_retention_days') as string);
		const backupEnabled = formData.get('backup_enabled') === 'on';

		if (!backupSchedule) {
			return fail(400, { error: 'Backup schedule is required' });
		}

		if (isNaN(backupRetentionDays) || backupRetentionDays < 1 || backupRetentionDays > 365) {
			return fail(400, { error: 'Backup retention days must be between 1 and 365' });
		}

		// --- AI settings (feature-flagged) ---
		let aiEnabled = false;
		let aiApiUrl = '';
		let aiApiKey = '';
		let aiModel = '';

		if (FEATURES.ai) {
			aiEnabled = formData.get('ai_enabled') === 'on';
			aiApiUrl = formData.get('ai_api_url') as string;
			const aiApiKeyInput = formData.get('ai_api_key') as string;
			aiApiKey = aiApiKeyInput || aiSettingsQueries.get()?.api_key || '';
			aiModel = formData.get('ai_model') as string;

			if (aiEnabled && !aiApiUrl) {
				return fail(400, { error: 'API URL is required when AI is enabled' });
			}

			if (aiEnabled && !aiModel) {
				return fail(400, { error: 'Model is required when AI is enabled' });
			}
		}

		// --- TMDB settings (preserve existing key if empty) ---
		const tmdbApiKeyInput = formData.get('tmdb_api_key') as string;
		const tmdbApiKey = tmdbApiKeyInput || tmdbSettingsQueries.get()?.api_key || '';

		// --- Arr defaults ---
		const arrApplyDefaultDelayProfiles = formData.get('arr_apply_default_delay_profiles') === 'on';

		// --- Persist all settings ---
		const logUpdated = logSettingsQueries.update({
			retentionDays: logRetentionDays,
			minLevel: logMinLevel,
			enabled: logEnabled,
			fileLogging: logFileLogging,
			consoleLogging: logConsoleLogging
		});

		if (!logUpdated) {
			await logger.error('Failed to update log settings', {
				source: 'settings/general'
			});
			return fail(500, { error: 'Failed to update log settings' });
		}

		const backupUpdated = backupSettingsQueries.update({
			schedule: backupSchedule,
			retentionDays: backupRetentionDays,
			enabled: backupEnabled
		});

		if (!backupUpdated) {
			await logger.error('Failed to update backup settings', {
				source: 'settings/general'
			});
			return fail(500, { error: 'Failed to update backup settings' });
		}

		if (FEATURES.ai) {
			const aiUpdated = aiSettingsQueries.update({
				enabled: aiEnabled,
				apiUrl: aiApiUrl || 'https://api.openai.com/v1',
				apiKey: aiApiKey || '',
				model: aiModel || 'gpt-4o-mini'
			});

			if (!aiUpdated) {
				await logger.error('Failed to update AI settings', {
					source: 'settings/general'
				});
				return fail(500, { error: 'Failed to update AI settings' });
			}
		}

		const tmdbUpdated = tmdbSettingsQueries.update({
			apiKey: tmdbApiKey || ''
		});

		if (!tmdbUpdated) {
			await logger.error('Failed to update TMDB settings', {
				source: 'settings/general'
			});
			return fail(500, { error: 'Failed to update TMDB settings' });
		}

		const arrUpdated = generalSettingsQueries.update({
			applyDefaultDelayProfiles: arrApplyDefaultDelayProfiles
		});

		if (!arrUpdated) {
			await logger.error('Failed to update arr default settings', {
				source: 'settings/general'
			});
			return fail(500, { error: 'Failed to update arr default settings' });
		}

		// --- Side effects ---
		logSettings.reload();
		scheduleLogCleanup();
		scheduleBackupJobs();

		await logger.info('General settings saved', {
			source: 'settings/general',
			meta: {
				logRetentionDays,
				logMinLevel,
				logEnabled,
				backupSchedule,
				backupRetentionDays,
				backupEnabled,
				aiEnabled,
				aiApiUrl,
				aiModel,
				arrApplyDefaultDelayProfiles
			}
		});

		return { success: true };
	}
};
