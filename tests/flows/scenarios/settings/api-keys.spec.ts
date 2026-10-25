/**
 * - Protects: API keys from Settings › Security. The New Key form stores the
 *   access and expiry it shows, and the key it hands out works with exactly
 *   that access.
 * - The plain key reaches the page once, in the API key field, and never in
 *   the Security page data.
 * - Deleting a key stops it at once.
 * - The integration tests apiKeyPermissions.test.ts and apiKey.test.ts cover
 *   the permission matrix, expiry and last use against the server.
 */
import { test, expect, FIXTURES_NAME } from '$flows/helpers/core/test.ts';
import { createAccount } from '$flows/helpers/auth/accounts.ts';
import {
	apiWithKey,
	createApiKey,
	deleteApiKey,
	securityPages
} from '$flows/helpers/auth/security.ts';

test.use({ appEnv: { AUTH: 'on' } });

const SCOPED_KEY = 'Scoped';
const FULL_KEY = 'Full';
const EXPIRY = { label: '30 days', days: 30 };
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Flow:
 * 1. The user creates the account.
 * 2. The user creates a key with a 30 day expiry, Databases "Read" and
 *    Backups "Read & write".
 * 3. A client calls the API with only that key.
 *
 * Expects:
 * - the key's row holds exactly that access
 * - it expires 30 days from now
 * - its hint is the key's last 4 characters
 * - the plain key isn't in the Security page data
 * - the key can list databases, and is refused the Arr list
 */
test('The New Key form stores the access it shows', async ({ page, playwright, baseURL }) => {
	await createAccount(page);
	const created = Date.now();
	const key = await createApiKey(page, SCOPED_KEY, undefined, {
		expiry: EXPIRY.label,
		access: { Databases: 'Read', Backups: 'Read & write' }
	});

	const row = (await securityPages.apiKeys(page)).find((apiKey) => apiKey.name === SCOPED_KEY);
	if (!row) throw new Error(`Security should list the key ${SCOPED_KEY}`);
	expect(row.permissions, 'The key should store exactly the access chosen').toEqual({
		databases: 'read',
		backups: 'write'
	});
	expect(row.expiresAt, 'The key should have an expiry').not.toBeNull();
	expect(
		Math.abs(Date.parse(row.expiresAt ?? '') - (created + EXPIRY.days * DAY_MS)),
		`The key should expire ${EXPIRY.days} days from now, within a minute`
	).toBeLessThan(60_000);
	expect(row.keyHint, "The hint should be the key's last 4 characters").toBe(key.slice(-4));

	const raw = await (await page.request.get('/settings/security/__data.json')).text();
	expect(raw.includes(key), 'The Security page data should not hold the plain key').toBe(false);

	const api = await apiWithKey(playwright, baseURL ?? '', key);
	try {
		const databases = await api.get('/api/v1/databases');
		expect(databases.status(), 'GET /api/v1/databases with Databases read should be 200').toBe(200);
		const names = ((await databases.json()) as { name: string }[]).map((db) => db.name);
		expect(names, 'The key should list the linked database').toEqual([FIXTURES_NAME]);

		const arrs = await api.get('/api/v1/arr');
		expect(arrs.status(), 'GET /api/v1/arr without Arr access should be 403').toBe(403);
	} finally {
		await api.dispose();
	}
});

/**
 * Flow:
 * 1. The user creates a full access key, and a client calls the API with it.
 * 2. On Security, the user clicks Delete API key in its row, then Delete in
 *    the dialog.
 *
 * Expects:
 * - the key is gone from the list
 * - the same request is now refused as unauthenticated
 */
test('Deleting a key from the Security page stops it at once', async ({
	page,
	playwright,
	baseURL
}) => {
	await createAccount(page);
	const key = await createApiKey(page, FULL_KEY);

	const api = await apiWithKey(playwright, baseURL ?? '', key);
	try {
		expect(
			(await api.get('/api/v1/status')).status(),
			'control: GET /api/v1/status with the key should be 200'
		).toBe(200);

		await deleteApiKey(page, FULL_KEY);
		expect(
			(await securityPages.apiKeys(page)).map((apiKey) => apiKey.name),
			'The key should be gone from the list'
		).toEqual([]);
		expect(
			(await api.get('/api/v1/status')).status(),
			'GET /api/v1/status with the deleted key should be 401'
		).toBe(401);
	} finally {
		await api.dispose();
	}
});
