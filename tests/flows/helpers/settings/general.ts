/**
 * Settings › General: typed readers for what the page loads and what it keeps
 * in the browser, and the fields a scenario can't find by label alone.
 *
 * Most settings are stored on the server and come back in the page data. The
 * Interface ones (icon style, alerts, fonts) live only in localStorage.
 */

import { test, type Locator, type Page } from '@playwright/test';
import type { App } from '#flows/harness/app.ts';
import { readTmdbToken } from '#flows/harness/settings.ts';
import { pageData } from '#flows/helpers/core/pageData.ts';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface GeneralSettingsData {
	logSettings: {
		retention_days: number;
		min_level: LogLevel;
		enabled: boolean;
		file_logging: boolean;
		console_logging: boolean;
	};
	backupSettings: {
		schedule: string;
		retention_days: number;
		enabled: boolean;
		include_database: boolean;
	};
	generalSettings: {
		date_format: 'auto' | 'mdy' | 'dmy' | 'ymd';
		landing_page: string | null;
		apply_default_delay_profiles: boolean;
		fail_on_referenced_delete: boolean;
		sync_prompt_enabled: boolean;
	};
	/** Only whether a token is stored; the token never reaches the page */
	tmdbSettings: { hasApiKey: boolean };
}

/** What Settings › General loads: the stored log, backup, behavior and TMDB settings */
export async function generalSettings(page: Page): Promise<GeneralSettingsData> {
	return await test.step(
		'Read the general settings',
		async () => {
			const data = await pageData<GeneralSettingsData>(page, '/settings/general');
			return {
				logSettings: data.logSettings,
				backupSettings: data.backupSettings,
				generalSettings: data.generalSettings,
				tmdbSettings: data.tmdbSettings
			};
		},
		{ box: true }
	);
}

export interface UiPreferences {
	/** "emoji" or "lucide", or null when never saved */
	navIconStyle: string | null;
	alertSettings: { position: string; durationMs: number } | null;
	fontSettings: { sans: string; mono: string } | null;
}

/** The Interface settings the browser keeps in localStorage */
export async function uiPreferences(page: Page): Promise<UiPreferences> {
	return await test.step(
		'Read the interface preferences',
		async () => {
			return await page.evaluate(() => {
				const json = (key: string) => {
					const value = localStorage.getItem(key);
					return value === null ? null : JSON.parse(value);
				};
				return {
					navIconStyle: localStorage.getItem('navIconStyle'),
					alertSettings: json('alertSettings'),
					fontSettings: json('fontSettings')
				};
			});
		},
		{ box: true }
	);
}

/**
 * The Retention Period (days) field of the Backups or Logging card. Both
 * share that label, so this picks one by the input's form name.
 */
export function retentionField(page: Page, card: 'backup' | 'log'): Locator {
	return page
		.getByRole('main')
		.getByRole('spinbutton', { name: 'Retention Period (days)' })
		.and(page.locator(`[name="${card}_retention_days"]`));
}

/**
 * The stored TMDB token, read from the app database. The page never shows it,
 * so a scenario that checks which token is kept reads it here.
 */
export function storedTmdbToken(app: App): string {
	return readTmdbToken(app.dir);
}
