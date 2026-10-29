/**
 * - Threat: someone who can edit an Arr instance, but doesn't know its API
 *   key or Basic Auth password, points the instance at a server they control.
 *   The next request would then hand that server the saved secrets.
 * - Defence: changing the URL needs the API key typed again, on the page and
 *   in the update action (src/routes/arr/[id]/settings/+page.server.ts). A
 *   new URL also drops saved Basic Auth unless it is typed again. A URL that
 *   only gains a trailing slash counts as the same address.
 * - Each test checks what the app stored and which fake Arr got the
 *   requests, and with which credentials.
 */
import { test, expect } from '#flows/helpers/core/test.ts';
import { saveForm } from '#flows/helpers/core/forms.ts';
import { openTab } from '#flows/helpers/core/nav.ts';
import { unflatten } from '#flows/helpers/core/pageData.ts';
import { addArr, arrInstance, arrSettings, editArr, openArr } from '#flows/helpers/sync/arrs.ts';
import { chooseDelayProfile, syncSection } from '#flows/helpers/sync/sync.ts';

const NAME = 'Moved Radarr';
const BASIC_AUTH = { username: 'proxy-user', password: 'proxy-pass' };

const KEY_NEEDED = 'Enter the API key to change the URL';
const BASIC_AUTH_NOTE =
	'Changing the URL removes the saved Basic Auth credentials. Re-enter them to keep using Basic Auth.';
const BASIC_AUTH_CLEARED = 'Saved Basic Auth credentials were removed because the URL changed';

/**
 * Flow:
 * 1. Start fakes A and B. The user adds an instance on A and saves a delay
 *    profile on its Sync tab.
 * 2. On the Settings tab, the user adds a trailing slash to the URL and
 *    saves.
 * 3. The user changes the URL to B.
 * 4. The user enters B's API key and saves.
 * 5. The user syncs Delay Profiles.
 *
 * Expects:
 * - a change that only adds a trailing slash saves without the key
 * - before step 4, Save is disabled and says "Enter the API key to change
 *   the URL"
 * - after the save, the stored URL is B, and B got a version probe
 * - the sync goes to B, and A gets no new requests
 */
test('a new URL needs the API key again', async ({ page, startArr }) => {
	const [a, b] = [await startArr('radarr-6'), await startArr('radarr-6')];
	await addArr(page, { name: NAME, fake: a });
	const { id } = await arrInstance(page, NAME);
	await openArr(page, NAME);
	await openTab(page, 'Sync');
	await chooseDelayProfile(page);

	await editArr(page, NAME, { url: `${a.url}/` });
	expect((await arrInstance(page, NAME)).url, 'The trailing slash should save').toBe(`${a.url}/`);

	await editArr(page, NAME, { url: b.url }, { save: false });
	const save = page.getByRole('main').getByRole('button', { name: 'Save', exact: true });
	await expect(save, 'Save should wait for the API key').toBeDisabled();
	await expect(save, `Save should say "${KEY_NEEDED}"`).toHaveAccessibleDescription(KEY_NEEDED);

	const aRequests = a.requests.length;
	await editArr(page, NAME, { apiKey: b.apiKey });
	expect((await arrSettings(page, id)).instance.url, 'The stored URL should be B').toBe(b.url);
	await b.waitFor('GET', '/api/v3/system/status');

	await openTab(page, 'Sync');
	const result = await syncSection(page, 'Delay Profiles');
	expect(result.status, 'The sync should succeed').toBe('idle');
	expect(b.sent('PUT', '/api/v3/delayprofile/1').length, 'The sync should go to B').toBeGreaterThan(
		0
	);
	expect(
		a.requests.slice(aRequests).map((request) => `${request.method} ${request.path}`),
		'A should get no requests after the move'
	).toEqual([]);
});

/**
 * Flow:
 * 1. Start fake A behind Basic Auth and fake B without it. The user adds an
 *    instance on A with Basic Auth.
 * 2. On the Settings tab, the user changes the URL to B and enters B's API
 *    key, leaving Basic Auth blank.
 * 3. The user saves.
 *
 * Expects:
 * - before saving, the form says the saved Basic Auth will be removed
 * - after saving, the warning alert says it was removed
 * - Basic Auth is no longer saved
 * - B never sees an Authorization header
 */
test('a new URL drops saved Basic Auth unless it is entered again', async ({ page, startArr }) => {
	const a = await startArr('radarr-6', { basicAuth: BASIC_AUTH });
	const b = await startArr('radarr-6');
	await addArr(page, { name: NAME, fake: a, basicAuth: BASIC_AUTH });
	const { id } = await arrInstance(page, NAME);

	await editArr(page, NAME, { url: b.url, apiKey: b.apiKey }, { save: false });
	await expect(
		page.getByRole('main').getByText(BASIC_AUTH_NOTE, { exact: true }),
		'The form should say the saved Basic Auth will be removed'
	).toBeVisible();
	await saveForm(page, { action: 'update' });

	await expect(
		page.getByText(BASIC_AUTH_CLEARED, { exact: true }),
		'The warning should say Basic Auth was removed'
	).toBeVisible();
	expect((await arrSettings(page, id)).hasBasicAuth, 'Basic Auth should no longer be saved').toBe(
		false
	);
	expect(b.requests.length, 'B should have been reached').toBeGreaterThan(0);
	expect(
		b.requests.filter((request) => request.headers.authorization !== undefined),
		'B should never see an Authorization header'
	).toEqual([]);
});

/**
 * Flow:
 * 1. Start fakes A and B. The user adds an instance on A.
 * 2. Post the Settings tab's update action straight to the server with B's
 *    URL and no API key, skipping the page.
 *
 * Expects:
 * - the action fails with a 400 and "Enter the API key to change the URL."
 * - the stored URL is still A
 * - B gets no requests
 */
test('the server refuses a new URL sent without the API key', async ({ page, startArr }) => {
	const [a, b] = [await startArr('radarr-6'), await startArr('radarr-6')];
	await addArr(page, { name: NAME, fake: a });
	const { id } = await arrInstance(page, NAME);

	const response = await page.request.post(`/arr/${id}/settings?/update`, {
		form: { name: NAME, url: b.url, api_key: '' },
		headers: {
			// SvelteKit refuses form posts from another origin before the action runs
			origin: new URL(page.url()).origin,
			'x-sveltekit-action': 'true',
			accept: 'application/json'
		}
	});
	const result = (await response.json()) as { type: string; status: number; data: string };
	expect(result.type, 'The action should fail').toBe('failure');
	expect(result.status, 'The action should answer 400').toBe(400);
	expect(unflatten(JSON.parse(result.data)), `The action should say "${KEY_NEEDED}."`).toEqual({
		error: `${KEY_NEEDED}.`
	});

	expect((await arrSettings(page, id)).instance.url, 'The stored URL should still be A').toBe(
		a.url
	);
	expect(b.requests, 'B should get no requests').toEqual([]);
});
