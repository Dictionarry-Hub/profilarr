/**
 * - Protects: an Arr instance's settings, from the add form and the Settings
 *   tab through the row the app stores, the jobs it schedules and the
 *   requests it sends the Arr.
 * - Secrets stay on the server: no API key or Basic Auth value reaches the
 *   API or the page, and fields left blank keep what is saved.
 * - Names and Arr addresses stay unique, and deleting an instance leaves no
 *   settings or jobs behind.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '$flows/helpers/core/test.ts';
import { saveForm, waitForAction } from '$flows/helpers/core/forms.ts';
import { scheduledJobs, waitForIdleJobs, waitForJobRun } from '$flows/helpers/core/jobs.ts';
import { openTab, sidebar, waitForHydration } from '$flows/helpers/core/nav.ts';
import {
	addArr,
	arrInstance,
	arrInstances,
	arrSettings,
	deleteArr,
	editArr,
	openArr
} from '$flows/helpers/sync/arrs.ts';
import { basicAuthHeader, type FakeArr } from '$flows/helpers/sync/fakeArr.ts';
import {
	addArrAndOpenSync,
	chooseDelayProfile,
	syncConfig,
	syncSection
} from '$flows/helpers/sync/sync.ts';

const NAME = 'Flow Radarr';
const OTHER_NAME = 'Second Radarr';
const RENAMED = 'Renamed Radarr';
const EXTERNAL_URL = 'https://radarr.example.com';
const NEW_EXTERNAL_URL = 'https://movies.example.com';
const TAGS = ['4k', 'remux'];
const ADDED_TAG = 'anime';
const BASIC_AUTH = { username: 'proxy-user', password: 'proxy-pass' };

const NAME_TAKEN = 'An instance with this name already exists';
const TARGET_TAKEN = 'This instance target is already configured';

/** An alert with this text, the newest when several show */
const alert = (page: Page, text: string) => page.getByText(text, { exact: true }).last();

/** The stored tag list, from the JSON text the instance row keeps */
const tagsOf = (tags: string | null) => JSON.parse(tags ?? '[]') as string[];

/** Every request the fake got, as "<method> <path>" with whether it carried the credentials */
function credentialsSeen(fake: FakeArr, from = 0) {
	const expected = basicAuthHeader(BASIC_AUTH);
	return fake.requests.slice(from).map((request) => ({
		request: `${request.method} ${request.path}`,
		apiKey: request.headers['x-api-key'] === fake.apiKey,
		basicAuth: request.headers.authorization === expected
	}));
}

/**
 * Flow:
 * 1. Start a fake Arr behind Basic Auth.
 * 2. The user adds an instance with Name, Type, URL, External URL, API Key,
 *    Username, Password and Tags filled in.
 * 3. The user clicks Test Connection, then Save.
 *
 * Expects:
 * - `/api/v1/arr` and the Settings tab data hold the name, type, URL,
 *   external URL and tags
 * - the Settings tab data reports Basic Auth as saved
 * - neither holds the API key or a Basic Auth value
 * - the Settings form shows API Key, Username and Password empty
 * - every request the fake got carried the Basic Auth header
 * - the version the connection test found is stored
 */
test('stores every field when adding an instance', async ({ page, startArr }) => {
	const fake = await startArr('radarr-6', { basicAuth: BASIC_AUTH });

	await addArr(page, {
		name: NAME,
		fake,
		externalUrl: EXTERNAL_URL,
		tags: TAGS,
		basicAuth: BASIC_AUTH
	});

	const listed = await arrInstance(page, NAME);
	const stored = {
		name: NAME,
		type: fake.type,
		url: fake.url,
		external_url: EXTERNAL_URL
	};
	expect(listed, '/api/v1/arr should hold every field').toMatchObject(stored);
	expect(tagsOf(listed.tags), '/api/v1/arr should hold the tags').toEqual(TAGS);

	const settings = await arrSettings(page, listed.id);
	expect(settings.instance, 'The Settings tab data should hold every field').toMatchObject(stored);
	expect(tagsOf(settings.instance.tags), 'The Settings tab data should hold the tags').toEqual(
		TAGS
	);
	expect(settings.hasBasicAuth, 'The Settings tab should report Basic Auth as saved').toBe(true);

	for (const [what, data] of [
		['/api/v1/arr', listed],
		['The Settings tab data', settings]
	] as const) {
		const text = JSON.stringify(data);
		for (const secret of [fake.apiKey, BASIC_AUTH.username, BASIC_AUTH.password]) {
			expect(text, `${what} should not hold a secret`).not.toContain(secret);
		}
	}

	await openArr(page, NAME);
	await openTab(page, 'Settings');
	const main = page.getByRole('main');
	await expect(main.getByLabel(/^API Key/), 'API Key should show empty').toHaveValue('');
	await expect(
		main.getByRole('textbox', { name: /^Username/ }),
		'Username should show empty'
	).toHaveValue('');
	await expect(main.getByLabel(/^Password/), 'Password should show empty').toHaveValue('');

	const seen = credentialsSeen(fake);
	expect(seen.length, 'The fake should have been reached').toBeGreaterThan(0);
	expect(
		seen.filter((request) => !request.basicAuth),
		'Every request should carry the Basic Auth header'
	).toEqual([]);
	expect(listed.detected_version, 'The detected version should be stored').toMatch(
		new RegExp(`^${fake.target.major}\\.`)
	);
});

/**
 * Flow:
 * 1. Start a fake Arr behind Basic Auth.
 * 2. The user fills the add form without Basic Auth and clicks Test
 *    Connection.
 * 3. The user clicks Save.
 *
 * Expects:
 * - Test Connection shows "Connection test failed"
 * - Save shows the same error and stays on the form
 * - `/api/v1/arr` lists no instance
 */
test('refuses a connection the Arr turns away', async ({ page, startArr }) => {
	const fake = await startArr('radarr-6', { basicAuth: BASIC_AUTH });
	await addArr(page, { name: NAME, fake, testConnection: false, save: false });
	const main = page.getByRole('main');

	for (const button of ['Test Connection', 'Save']) {
		const validated = page.waitForResponse((r) => new URL(r.url()).pathname === '/arr/validate');
		await main.getByRole('button', { name: button, exact: true }).click();
		const response = await validated;
		expect(response.status(), `${button} should be refused`).toBe(400);
		expect(
			((await response.json()) as { error: string }).error,
			`${button} should report the failed test`
		).toBe('Connection test failed');
		await expect(
			alert(page, 'Connection test failed'),
			`${button} should show the error`
		).toBeVisible();
	}

	await expect(page, 'Save should stay on the form').toHaveURL(
		(url) => url.pathname === '/arr/new'
	);
	expect(await arrInstances(page), '/api/v1/arr should list no instance').toEqual([]);
	expect(
		fake.requests.every((r) => r.status === 401),
		'The fake should refuse every request'
	).toBe(true);
});

/**
 * Flow:
 * 1. The user adds an instance with two tags and opens its Settings tab.
 * 2. The user changes Name and External URL, removes a tag with its
 *    "Remove <tag>" button and adds another.
 * 3. The user sets Library Refresh to "Every hour", turns on Cleanup, saves
 *    and reloads.
 * 4. The user sets Library Refresh back to Manual, turns off Cleanup and
 *    saves.
 *
 * Expects:
 * - after step 3, the page data holds every change, the sidebar shows the
 *   new name and the Type dropdown is disabled
 * - after step 3, Settings › Jobs lists `arr.library.refresh:{id}` about 60
 *   minutes ahead and `arr.cleanup:{id}`, and the cleanup settings are on
 *   with a future next run
 * - after step 4, both jobs are gone, the cleanup settings are off and Run
 *   Now is hidden
 */
test('keeps every edited field after a reload', async ({ page, fakeRadarr }) => {
	await addArr(page, { name: NAME, fake: fakeRadarr, tags: TAGS });
	const { id } = await arrInstance(page, NAME);
	const [removed, kept] = TAGS;

	const saved = Date.now();
	await editArr(page, NAME, {
		name: RENAMED,
		externalUrl: NEW_EXTERNAL_URL,
		removeTags: [removed],
		addTags: [ADDED_TAG],
		libraryRefresh: 'Every hour',
		cleanup: true
	});
	await page.reload();
	await waitForHydration(page);

	const settings = await arrSettings(page, id);
	expect(settings.instance, 'The Settings tab data should hold every change').toMatchObject({
		name: RENAMED,
		external_url: NEW_EXTERNAL_URL,
		library_refresh_interval: 60
	});
	expect(tagsOf(settings.instance.tags), 'The tags should be changed').toEqual([kept, ADDED_TAG]);
	expect(settings.cleanupSettings?.enabled, 'Cleanup should be stored as on').toBe(true);
	expect(
		new Date(settings.cleanupSettings?.nextRunAt ?? 0).getTime(),
		'Cleanup should have a future next run'
	).toBeGreaterThan(Date.now());
	await expect(
		sidebar(page).getByRole('link', { name: RENAMED, exact: true }),
		'The sidebar should show the new name'
	).toBeVisible();
	await expect(
		page.getByRole('main').getByRole('button', { name: /^Type: / }),
		'The Type dropdown should be disabled'
	).toBeDisabled();

	const jobs = await scheduledJobs(page);
	const refresh = jobs.find((job) => job.description === `arr.library.refresh:${id}`);
	expect(refresh, 'Settings › Jobs should list the library refresh').toBeDefined();
	const minutesAhead = (new Date(refresh?.next_run_at ?? 0).getTime() - saved) / 60_000;
	expect(minutesAhead, 'The library refresh should run about an hour ahead').toBeGreaterThan(59);
	expect(minutesAhead, 'The library refresh should run about an hour ahead').toBeLessThan(62);
	expect(
		jobs.map((job) => job.description),
		'Settings › Jobs should list the cleanup'
	).toContain(`arr.cleanup:${id}`);

	await editArr(page, RENAMED, { libraryRefresh: 'Manual', cleanup: false });

	const after = (await scheduledJobs(page)).map((job) => job.description);
	expect(after, 'The library refresh should be unscheduled').not.toContain(
		`arr.library.refresh:${id}`
	);
	expect(after, 'The cleanup should be unscheduled').not.toContain(`arr.cleanup:${id}`);
	expect(
		(await arrSettings(page, id)).cleanupSettings?.enabled,
		'Cleanup should be stored as off'
	).toBe(false);
	await expect(
		page.getByRole('main').getByRole('button', { name: 'Run Now', exact: true }),
		'Run Now should be hidden'
	).toHaveCount(0);
});

/**
 * Flow:
 * 1. The user adds an instance behind Basic Auth and saves a delay profile
 *    on its Sync tab.
 * 2. The user edits only the tags on the Settings tab, leaving API Key,
 *    Username and Password blank, and saves.
 * 3. The user syncs Delay Profiles.
 *
 * Expects:
 * - the sync succeeds
 * - every request of the sync carries the stored API key and the Basic Auth
 *   header
 * - Basic Auth is still saved
 */
test('keeps the saved API key and Basic Auth when the fields are left blank', async ({
	page,
	startArr
}) => {
	const fake = await startArr('radarr-6', { basicAuth: BASIC_AUTH });
	await addArr(page, { name: NAME, fake, basicAuth: BASIC_AUTH });
	const { id } = await arrInstance(page, NAME);
	await openArr(page, NAME);
	await openTab(page, 'Sync');
	await chooseDelayProfile(page);

	await editArr(page, NAME, { addTags: [ADDED_TAG] });
	await openTab(page, 'Sync');
	const before = fake.requests.length;
	const result = await syncSection(page, 'Delay Profiles');

	expect(result.status, 'The sync should succeed').toBe('idle');
	const seen = credentialsSeen(fake, before);
	expect(
		seen.map((request) => request.request),
		'The sync should update the delay profile'
	).toContain('PUT /api/v3/delayprofile/1');
	expect(
		seen.filter((request) => !request.apiKey || !request.basicAuth),
		'Every sync request should carry the stored API key and Basic Auth'
	).toEqual([]);
	expect((await arrSettings(page, id)).hasBasicAuth, 'Basic Auth should still be saved').toBe(true);
});

/**
 * Flow:
 * 1. The user adds an instance.
 * 2. The user adds a second instance with the first one's name, then
 *    corrects the name but uses the first one's URL.
 * 3. The user corrects the URL and saves, then edits the second instance to
 *    the first one's name, then to the first one's URL.
 *
 * Expects:
 * - adding refuses the name with "An instance with this name already
 *   exists" and the URL with "This instance target is already configured"
 * - editing refuses both with the same errors
 * - `/api/v1/arr` doesn't change after a refused save
 */
test('refuses a name or address another instance has', async ({ page, fakeRadarr, startArr }) => {
	const other = await startArr('radarr-6');
	await addArr(page, { name: NAME, fake: fakeRadarr });
	const one = await arrInstances(page);

	/** Click Save and check the action refuses it with `error`, shown as an alert */
	async function expectRefused(error: string, what: string) {
		const posted = waitForAction(page);
		await page.getByRole('main').getByRole('button', { name: 'Save', exact: true }).click();
		const result = await posted;
		expect(result.type, `${what} should be refused`).toBe('failure');
		expect((result.data as { error?: string }).error, `${what} should say why`).toBe(error);
		await expect(alert(page, error), `${what} should show the error`).toBeVisible();
	}

	await addArr(page, { name: NAME, fake: other, testConnection: false, save: false });
	await expectRefused(NAME_TAKEN, 'Adding with a taken name');
	// The form keeps its values, so the user corrects it in place
	const main = page.getByRole('main');
	await main.getByRole('textbox', { name: /^Name/ }).fill(OTHER_NAME);
	await main.getByRole('textbox', { name: /^URL/ }).fill(fakeRadarr.url);
	await main.getByLabel(/^API Key/).fill(fakeRadarr.apiKey);
	await expectRefused(TARGET_TAKEN, 'Adding with a taken URL');
	await main.getByRole('textbox', { name: /^URL/ }).fill(other.url);
	await main.getByLabel(/^API Key/).fill(other.apiKey);
	expect(await arrInstances(page), 'Refused adds should store nothing').toEqual(one);

	await saveForm(page);
	const two = await arrInstances(page);
	expect(
		two.map((instance) => instance.name),
		'The corrected add should store the second instance'
	).toEqual([NAME, OTHER_NAME]);

	await editArr(page, OTHER_NAME, { name: NAME }, { save: false });
	await expectRefused(NAME_TAKEN, 'Renaming to a taken name');
	// The form still shows the refused name, so this edits the same instance in place
	await editArr(
		page,
		NAME,
		{ name: OTHER_NAME, url: fakeRadarr.url, apiKey: fakeRadarr.apiKey },
		{ save: false }
	);
	await expectRefused(TARGET_TAKEN, 'Moving to a taken URL');
	expect(await arrInstances(page), 'Refused edits should change nothing').toEqual(two);
});

/**
 * Flow:
 * 1. The user syncs Delay Profiles, then sets Library Refresh and turns on
 *    Cleanup.
 * 2. The test waits until no job is running.
 * 3. On the Settings tab, the user clicks Delete and confirms "Delete" in the
 *    "Delete Instance" dialog.
 * 4. The user adds an instance with the same name and URL.
 *
 * Expects:
 * - the page lands on `/arr`, and neither the API nor the sidebar lists the
 *   instance; its Sync page answers 404
 * - Settings › Jobs lists nothing for the instance
 * - the earlier sync run is still in run history
 * - the fake gets no requests after the delete
 * - the new instance starts with nothing configured
 */
test('deleting an instance removes its settings and jobs', async ({ page, fakeRadarr }) => {
	const name = `Fake ${fakeRadarr.target.label}`;
	const started = Date.now();
	await addArrAndOpenSync(page, fakeRadarr);
	const { id } = await arrInstance(page, name);
	await chooseDelayProfile(page);
	await syncSection(page, 'Delay Profiles');
	const synced = await waitForJobRun(page, 'arr.sync.delayProfiles', { after: started });
	await editArr(page, name, { libraryRefresh: 'Every hour', cleanup: true });

	await waitForIdleJobs(page);
	const requestsBefore = fakeRadarr.requests.length;
	await deleteArr(page, name);

	expect(
		(await arrInstances(page)).map((instance) => instance.id),
		'/api/v1/arr should not list the instance'
	).not.toContain(id);
	await expect(
		sidebar(page).getByRole('link', { name, exact: true }),
		'The sidebar should not list the instance'
	).toHaveCount(0);
	expect(
		(await page.request.get(`/arr/${id}/sync`)).status(),
		'The Sync page should answer 404'
	).toBe(404);
	expect(
		(await scheduledJobs(page)).filter((job) => job.description.endsWith(`:${id}`)),
		'Settings › Jobs should list nothing for the instance'
	).toEqual([]);
	expect(
		(await waitForJobRun(page, 'arr.sync.delayProfiles', { after: started })).id,
		'The sync run should stay in run history'
	).toBe(synced.id);
	expect(fakeRadarr.requests.length, 'The fake should get no requests after the delete').toBe(
		requestsBefore
	);

	await addArr(page, { name, fake: fakeRadarr });
	const added = await arrInstance(page, name);
	expect(added.id, 'The new instance should get a new id').not.toBe(id);
	expect(added.library_refresh_interval, 'Library Refresh should start manual').toBe(0);
	expect(
		(await arrSettings(page, added.id)).cleanupSettings,
		'The new instance should have no cleanup settings'
	).toBeNull();
	expect(
		(await syncConfig(page, added.id)).syncData,
		'The new instance should have nothing to sync'
	).toMatchObject({
		qualityProfiles: { selections: [] },
		delayProfiles: { databaseId: null, profileName: null },
		mediaManagement: {
			namingDatabaseId: null,
			qualityDefinitionsDatabaseId: null,
			mediaSettingsDatabaseId: null
		}
	});
});
