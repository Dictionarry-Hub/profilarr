/**
 * Integration tests for the landing page setting.
 *
 * Saves the setting through the General Settings form action and checks where
 * `/` redirects. No database is linked, so Automatic means Databases; the
 * linked-database default is covered by the resolveLandingPage unit tests.
 */

import { assertEquals } from '@std/assert';
import { afterAll, beforeAll, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import { TestClient } from '#integration/harness/client.ts';
import { createUser, login } from '#integration/harness/setup.ts';
import { openDb } from '#integration/harness/db.ts';

const PORT = PORTS.settings.landingPage;
const ORIGIN = `http://localhost:${PORT}`;

let client: TestClient;

/**
 * Saves General Settings with the given landing page and returns the action's
 * status. Form actions answer HTTP 200 with the real status in the JSON body.
 */
async function saveLandingPage(landingPage: string): Promise<number> {
	const res = await client.postForm(
		'/settings/general?/save',
		{
			date_format: 'auto',
			landing_page: landingPage,
			arr_apply_default_delay_profiles: 'on',
			fail_on_referenced_delete: 'on',
			sync_prompt_enabled: 'on',
			backup_enabled: 'on',
			backup_schedule: 'daily',
			backup_retention_days: '30',
			log_enabled: 'on',
			log_file_logging: 'on',
			log_console_logging: 'on',
			log_retention_days: '30',
			log_min_level: 'INFO',
			tmdb_api_key: ''
		},
		{ headers: { Origin: ORIGIN } }
	);
	const body = await res.json();
	return body.status;
}

function storedLandingPage(): string | null {
	const db = openDb(getDbPath(PORT));
	try {
		const row = db.prepare('SELECT landing_page FROM general_settings WHERE id = 1').get() as
			{ landing_page: string | null } | undefined;
		return row?.landing_page ?? null;
	} finally {
		db.close();
	}
}

async function landingRedirect(): Promise<string | null> {
	const res = await client.get('/');
	assertEquals(res.status, 302);
	return res.headers.get('location');
}

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');

	client = new TestClient(ORIGIN);
	await createUser(client, 'admin', 'password123', ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
});

afterAll(async () => {
	await stopServer(PORT);
});

test('defaults to Databases when no page is chosen and no database is linked', async () => {
	assertEquals(storedLandingPage(), null);
	assertEquals(await landingRedirect(), '/databases');
});

test('saving a page makes / open it', async () => {
	assertEquals(await saveLandingPage('arrs'), 200);
	assertEquals(storedLandingPage(), 'arrs');
	assertEquals(await landingRedirect(), '/arr');
});

test('saving an unknown page is rejected and keeps the current choice', async () => {
	assertEquals(await saveLandingPage('dashboard'), 400);
	assertEquals(storedLandingPage(), 'arrs');
	assertEquals(await landingRedirect(), '/arr');
});

test('switching back to Automatic clears the stored page', async () => {
	assertEquals(await saveLandingPage(''), 200);
	assertEquals(storedLandingPage(), null);
	assertEquals(await landingRedirect(), '/databases');
});
