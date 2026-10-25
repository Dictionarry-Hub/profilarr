/**
 * - Protects: Settings › General, from each card's controls through the rows
 *   the app stores (log, backup, behavior and TMDB settings) and the
 *   preferences the browser keeps (icons, alerts, fonts).
 * - Turning Automatic Backups or Logging off saves, and keeps the hidden
 *   retention and level as stored.
 * - The TMDB token stays on the server: it never reaches the page, a blank
 *   field keeps it, and Reset removes it.
 * - Apply Default Delay Profile off leaves a new Arr's delay profile alone.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '$flows/helpers/core/test.ts';
import { storedTmdbToken } from '$flows/harness/settings.ts';
import { chooseOption, fillField, saveForm, setSwitch } from '$flows/helpers/core/forms.ts';
import { openSidebarPage, waitForHydration } from '$flows/helpers/core/nav.ts';
import { pageData } from '$flows/helpers/core/pageData.ts';
import { addArr } from '$flows/helpers/sync/arrs.ts';
import { generalSettings, retentionField, uiPreferences } from '$flows/helpers/settings/general.ts';

const ALERT_POSITION = { label: 'Bottom left', value: 'bottom-left' };
const ALERT_SECONDS = 3;
const DATE_FORMAT = { label: 'YYYY-MM-DD', value: 'ymd' };
const OTHER_DATE_FORMAT = 'DD/MM/YYYY';
const SANS_FONT = { label: 'Inter', value: 'inter' };
const MONO_FONT = { label: 'JetBrains Mono', value: 'jetbrains-mono' };
/** `--font-sans` once Inter is chosen (src/lib/client/stores/font.ts) */
const INTER_STACK = "'Inter', ui-sans-serif, system-ui, sans-serif";
const LANDING_PAGE = { label: 'Delay Profiles', value: 'delay-profiles' };
const BACKUP_SCHEDULE = { label: 'Weekly', value: 'weekly' };
const BACKUP_RETENTION = 14;
const LOG_LEVEL = 'WARN';
const LOG_RETENTION = 7;

const TMDB_TOKEN = 'flows-tmdb-token-first';
const TMDB_TOKEN_2 = 'flows-tmdb-token-second';
const TMDB_FIELD = 'API Read Access Token';
const TMDB_KEEP = 'Leave blank to keep existing key';
const TMDB_REMOVE = 'Token will be removed on save';

const ARR_NAME = 'Flow Radarr';

/** Every switch the first test sets, by its name, with the state it saves */
const SWITCHES = {
	'Emoji Icons': true,
	'Apply Default Delay Profile': false,
	'Block Referenced Deletes': false,
	'Prompt to Sync Changes': true,
	'Console Logging': false
} as const;

/** Every dropdown the first test sets, by its name, with the option it saves */
const DROPDOWNS = {
	'Alert Position': ALERT_POSITION.label,
	'Date Format': DATE_FORMAT.label,
	'Sans Font': SANS_FONT.label,
	'Mono Font': MONO_FONT.label,
	'Landing Page': LANDING_PAGE.label,
	Schedule: BACKUP_SCHEDULE.label,
	'Minimum Level': LOG_LEVEL
} as const;

/** A card's Reset button, in the header of the card titled `card` */
function resetButton(page: Page, card: string) {
	const header = page
		.getByRole('main')
		.locator('div')
		.filter({ has: page.getByRole('heading', { name: card, exact: true }) })
		.filter({ has: page.getByRole('button', { name: `Collapse ${card}` }) })
		.last();
	return header.getByRole('button', { name: 'Reset', exact: true });
}

/** Fill a retention field and leave it, which is when a number field commits */
async function setRetention(page: Page, card: 'backup' | 'log', days: number): Promise<void> {
	const field = retentionField(page, card);
	await field.fill(String(days));
	await field.press('Tab');
	await expect(field, `The ${card} retention should hold ${days}`).toHaveValue(String(days));
}

/** The TMDB token field; it is a password input, so it has no textbox role */
const tmdbField = (page: Page) => page.getByRole('main').getByLabel(TMDB_FIELD, { exact: true });

/** Fail unless neither the raw page data nor the rendered page holds `secret` */
async function expectNotOnPage(page: Page, path: string, secret: string): Promise<void> {
	const raw = await (await page.request.get(`${path}/__data.json`)).text();
	expect(raw.includes(secret), `${path}/__data.json should not hold the secret`).toBe(false);
	expect((await page.content()).includes(secret), `${path} should not render the secret`).toBe(
		false
	);
}

/**
 * Flow:
 * 1. The user opens General from the sidebar.
 * 2. Interface: turns Emoji Icons on, and sets Alert Position, Alert Duration
 *    (seconds), Date Format, Sans Font and Mono Font.
 * 3. Behavior: turns Apply Default Delay Profile and Block Referenced Deletes
 *    off, turns Prompt to Sync Changes on, and sets Landing Page.
 * 4. Backups: sets Schedule and the backup retention.
 * 5. Logging: sets Minimum Level, turns Console Logging off and sets the log
 *    retention.
 * 6. The user saves and reloads.
 *
 * Expects:
 * - the stored log, backup and behavior settings hold every new value
 * - `/api/v1/backups/settings` agrees on schedule and retention
 * - after the reload, each switch and dropdown shows the saved value, and
 *   Save is disabled
 * - the browser keeps the icon style, alert settings and fonts, and `<html>`
 *   uses the Inter stack
 * - the layout's date format is the saved one
 * - `/` opens Delay Profiles
 */
test('Keeps every setting after a reload', async ({ page }) => {
	await openSidebarPage(page, 'General');
	const before = await generalSettings(page);
	const main = page.getByRole('main');

	await setSwitch(main, 'Emoji Icons', SWITCHES['Emoji Icons']);
	await chooseOption(main, 'Alert Position', ALERT_POSITION.label);
	await fillField(main, 'Alert Duration (seconds)', ALERT_SECONDS);
	await chooseOption(main, 'Date Format', DATE_FORMAT.label);
	await chooseOption(main, 'Sans Font', SANS_FONT.label);
	await chooseOption(main, 'Mono Font', MONO_FONT.label);

	await setSwitch(main, 'Apply Default Delay Profile', SWITCHES['Apply Default Delay Profile']);
	await setSwitch(main, 'Block Referenced Deletes', SWITCHES['Block Referenced Deletes']);
	await setSwitch(main, 'Prompt to Sync Changes', SWITCHES['Prompt to Sync Changes']);
	await chooseOption(main, 'Landing Page', LANDING_PAGE.label);

	await chooseOption(main, 'Schedule', BACKUP_SCHEDULE.label);
	await setRetention(page, 'backup', BACKUP_RETENTION);

	await chooseOption(main, 'Minimum Level', LOG_LEVEL);
	await setSwitch(main, 'Console Logging', SWITCHES['Console Logging']);
	await setRetention(page, 'log', LOG_RETENTION);

	await saveForm(page, { action: 'save' });
	await page.reload();
	await waitForHydration(page);

	const after = await generalSettings(page);
	expect(after.logSettings, 'The stored log settings should hold every new value').toEqual({
		...before.logSettings,
		retention_days: LOG_RETENTION,
		min_level: LOG_LEVEL,
		console_logging: false
	});
	expect(after.backupSettings, 'The stored backup settings should hold every new value').toEqual({
		...before.backupSettings,
		schedule: BACKUP_SCHEDULE.value,
		retention_days: BACKUP_RETENTION
	});
	expect(
		after.generalSettings,
		'The stored behavior and interface settings should hold every new value'
	).toEqual({
		date_format: DATE_FORMAT.value,
		landing_page: LANDING_PAGE.value,
		apply_default_delay_profiles: false,
		fail_on_referenced_delete: false,
		sync_prompt_enabled: true
	});

	const response = await page.request.get('/api/v1/backups/settings');
	expect(response.ok(), 'GET /api/v1/backups/settings should answer').toBe(true);
	const api = (await response.json()) as { schedule: string; retentionDays: number };
	expect(
		{ schedule: api.schedule, retentionDays: api.retentionDays },
		'The backup settings API should agree on schedule and retention'
	).toEqual({ schedule: BACKUP_SCHEDULE.value, retentionDays: BACKUP_RETENTION });

	for (const [name, on] of Object.entries(SWITCHES)) {
		await expect(
			main.getByRole('switch', { name, exact: true }),
			`${name} should show ${on ? 'on' : 'off'} after the reload`
		).toHaveAttribute('aria-checked', String(on));
	}
	for (const [label, option] of Object.entries(DROPDOWNS)) {
		await expect(
			main.getByRole('button', { name: `${label}: ${option}`, exact: true }),
			`${label} should show ${option} after the reload`
		).toBeVisible();
	}
	await expect(
		main.getByRole('spinbutton', { name: 'Alert Duration (seconds)' }),
		'Alert Duration should show the saved seconds'
	).toHaveValue(String(ALERT_SECONDS));
	await expect(
		retentionField(page, 'backup'),
		'The backup retention should show the saved days'
	).toHaveValue(String(BACKUP_RETENTION));
	await expect(
		retentionField(page, 'log'),
		'The log retention should show the saved days'
	).toHaveValue(String(LOG_RETENTION));
	await expect(
		main.getByRole('button', { name: 'Save', exact: true }),
		'Save should be disabled with nothing changed'
	).toBeDisabled();

	expect(await uiPreferences(page), 'The browser should keep the interface settings').toEqual({
		navIconStyle: 'emoji',
		alertSettings: { position: ALERT_POSITION.value, durationMs: ALERT_SECONDS * 1000 },
		fontSettings: { sans: SANS_FONT.value, mono: MONO_FONT.value }
	});
	expect(
		await page.evaluate(() => document.documentElement.style.getPropertyValue('--font-sans')),
		'<html> should use the Inter stack'
	).toBe(INTER_STACK);

	const layout = await pageData<{ dateFormat: string }>(page, '/settings/general');
	expect(layout.dateFormat, 'The layout should carry the saved date format').toBe(
		DATE_FORMAT.value
	);

	await page.goto('/');
	await expect(page, '/ should open Delay Profiles').toHaveURL((url) =>
		/^\/delay-profiles\/\d+$/.test(url.pathname)
	);
});

/**
 * Flow:
 * 1. Read the stored backup schedule and retention.
 * 2. The user turns Automatic Backups off and saves.
 * 3. The user reloads.
 *
 * Expects:
 * - the save succeeds
 * - the switch is off after the reload
 * - the stored schedule and retention are unchanged
 */
test('Turning Automatic Backups off saves', async ({ page }) => {
	await openSidebarPage(page, 'General');
	const before = await generalSettings(page);
	expect(before.backupSettings.enabled, 'control: backups should start on').toBe(true);
	const main = page.getByRole('main');

	await setSwitch(main, 'Automatic Backups', false);
	await saveForm(page, { action: 'save' });
	await page.reload();
	await waitForHydration(page);

	await expect(
		main.getByRole('switch', { name: 'Automatic Backups', exact: true }),
		'Automatic Backups should be off after the reload'
	).toHaveAttribute('aria-checked', 'false');
	expect(
		(await generalSettings(page)).backupSettings,
		'Only enabled should change; the schedule and retention stay as stored'
	).toEqual({ ...before.backupSettings, enabled: false });
});

/**
 * Flow:
 * 1. Read the stored log retention and minimum level.
 * 2. The user turns Logging off and saves.
 * 3. The user reloads.
 *
 * Expects:
 * - the save succeeds
 * - the switch is off after the reload
 * - the stored retention and minimum level are unchanged
 */
test('Turning Logging off saves', async ({ page }) => {
	await openSidebarPage(page, 'General');
	const before = await generalSettings(page);
	expect(before.logSettings.enabled, 'control: logging should start on').toBe(true);
	const main = page.getByRole('main');

	await setSwitch(main, 'Logging', false);
	await saveForm(page, { action: 'save' });
	await page.reload();
	await waitForHydration(page);

	await expect(
		main.getByRole('switch', { name: 'Logging', exact: true }),
		'Logging should be off after the reload'
	).toHaveAttribute('aria-checked', 'false');
	expect(
		(await generalSettings(page)).logSettings,
		'Only enabled should change; the retention and minimum level stay as stored'
	).toEqual({ ...before.logSettings, enabled: false });
});

/**
 * Flow:
 * 1. The user sets Minimum Level to WARN and saves.
 * 2. The user clicks Reset on the Logging card and saves.
 *
 * Expects:
 * - the stored minimum level is DEBUG, the level a fresh install stores
 */
test("Logging's Reset sets the level to DEBUG", async ({ page }) => {
	await openSidebarPage(page, 'General');
	const main = page.getByRole('main');
	await chooseOption(main, 'Minimum Level', LOG_LEVEL);
	await saveForm(page, { action: 'save' });
	expect(
		(await generalSettings(page)).logSettings.min_level,
		`control: the stored level should be ${LOG_LEVEL} before the reset`
	).toBe(LOG_LEVEL);

	await resetButton(page, 'Logging').click();
	await saveForm(page, { action: 'save' });

	expect((await generalSettings(page)).logSettings.min_level, 'Reset should store DEBUG').toBe(
		'DEBUG'
	);
});

/**
 * Flow:
 * 1. The user fills API Read Access Token and saves.
 * 2. The user reloads.
 * 3. The user changes Date Format, leaves the token blank and saves.
 * 4. The user types a second token and saves.
 *
 * Expects:
 * - the page data says a token is stored
 * - the token is in neither the raw page data nor the rendered page
 * - after the reload the field is empty and says a blank keeps the key
 * - the stored token is the first after step 3 and the second after step 4
 */
test('The TMDB token stays on the server', async ({ app, page }) => {
	await openSidebarPage(page, 'General');
	await tmdbField(page).fill(TMDB_TOKEN);
	await saveForm(page, { action: 'save' });

	expect(
		(await generalSettings(page)).tmdbSettings.hasApiKey,
		'The page data should say a token is stored'
	).toBe(true);
	await page.reload();
	await waitForHydration(page);
	await expectNotOnPage(page, '/settings/general', TMDB_TOKEN);

	await expect(tmdbField(page), 'The token field should load empty').toHaveValue('');
	await expect(
		page.getByRole('main').getByText(TMDB_KEEP, { exact: true }),
		'The token field should say a blank keeps the stored key'
	).toBeVisible();

	await chooseOption(page.getByRole('main'), 'Date Format', OTHER_DATE_FORMAT);
	await saveForm(page, { action: 'save' });
	expect(storedTmdbToken(app.dir), 'A blank field should keep the first token').toBe(TMDB_TOKEN);

	await tmdbField(page).fill(TMDB_TOKEN_2);
	await saveForm(page, { action: 'save' });
	expect(storedTmdbToken(app.dir), 'A typed token should replace the stored one').toBe(
		TMDB_TOKEN_2
	);
	await expectNotOnPage(page, '/settings/general', TMDB_TOKEN_2);
});

/**
 * Flow:
 * 1. The user saves a token and reloads.
 * 2. The user clicks Reset on the TMDB card.
 * 3. The user saves.
 *
 * Expects:
 * - after Reset, the field says the token will be removed and Save is
 *   enabled
 * - after the save, no token is stored
 */
test('TMDB Reset removes a stored token', async ({ app, page }) => {
	await openSidebarPage(page, 'General');
	await tmdbField(page).fill(TMDB_TOKEN);
	await saveForm(page, { action: 'save' });
	await page.reload();
	await waitForHydration(page);
	expect(storedTmdbToken(app.dir), 'control: the token should be stored').toBe(TMDB_TOKEN);

	await resetButton(page, 'TMDB Configuration').click();
	await expect(
		page.getByRole('main').getByText(TMDB_REMOVE, { exact: true }),
		'After Reset, the field should say the token will be removed'
	).toBeVisible();
	await expect(
		page.getByRole('main').getByRole('button', { name: 'Save', exact: true }),
		'Reset should make the form dirty, so Save is enabled'
	).toBeEnabled();
	await saveForm(page, { action: 'save' });

	expect(
		(await generalSettings(page)).tmdbSettings.hasApiKey,
		'The page data should say no token is stored'
	).toBe(false);
	expect(storedTmdbToken(app.dir), 'Reset should remove the stored token').toBe('');
});

/**
 * Flow:
 * 1. The user turns Apply Default Delay Profile off and saves.
 * 2. The user adds a Radarr instance.
 *
 * Expects:
 * - the Arr gets no request to replace its delay profile
 */
test('A new Arr keeps its delay profile when the default is off', async ({ page, fakeRadarr }) => {
	await openSidebarPage(page, 'General');
	await setSwitch(page.getByRole('main'), 'Apply Default Delay Profile', false);
	await saveForm(page, { action: 'save' });

	await addArr(page, { name: ARR_NAME, fake: fakeRadarr });

	const defaultProfile = `${fakeRadarr.target.apiBase}/delayprofile/1`;
	expect(
		fakeRadarr.requests
			.filter((request) => request.method === 'PUT' && request.path === defaultProfile)
			.map((request) => `${request.method} ${request.path}`),
		`The Arr should get no PUT ${defaultProfile}`
	).toEqual([]);
});
