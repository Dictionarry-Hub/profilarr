/**
 * Integration tests: base URL (subpath behind a reverse proxy)
 *
 * Server on PORTS.auth.baseUrl with BASE_URL=/profilarr. No proxy involved, so
 * requests carry the prefix exactly as a proxy would forward it.
 *
 * Tests:
 * 1. Prefixed requests route normally (the adapter strips the prefix)
 * 2. Requests outside the base are 404, the app is served only from its subpath
 * 3. Server side redirects put the prefix back on the Location header
 * 4. Rendered pages reference assets relative to the page, not from the root
 * 5. Assets resolved from a rendered page are actually served under the prefix
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';

const PORT = PORTS.auth.baseUrl;
const ORIGIN = `http://localhost:${PORT}`;
const BASE_URL = '/profilarr';

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN, BASE_URL }, 'preview');
	await createUserDirect(getDbPath(PORT), 'admin', 'password123');
});

teardown(async () => {
	await stopServer(PORT);
});

test('prefixed request reaches the route', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.get(`${BASE_URL}/api/v1/health`);

	assertEquals(res.status, 200);
	const body = await res.json();
	assertEquals(typeof body.status, 'string');
});

test('request outside the base is 404', async () => {
	// Profilarr is served only from its subpath, the same as Radarr and Sonarr, so a
	// proxy has to pass the prefix through rather than stripping it.
	const client = new TestClient(ORIGIN);

	assertEquals((await client.get('/api/v1/health')).status, 404);
	assertEquals((await client.get('/auth/login')).status, 404);
	assertEquals((await client.get('/')).status, 404);
	// Not a segment boundary, so this is a different path entirely.
	assertEquals((await client.get('/profilarr-two/api/v1/health')).status, 404);
});

test('redirect Location carries the prefix', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.get(`${BASE_URL}/databases`);

	assertEquals(res.status, 303);
	assertStringIncludes(res.headers.get('location') ?? '', `${BASE_URL}/auth/login`);
});

test('rendered page references assets relative to the page', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.get(`${BASE_URL}/auth/login`);

	assertEquals(res.status, 200);
	const html = await res.text();

	// Asset URLs anchored at the server root would 404 behind the proxy. SvelteKit's
	// relative paths are what make a runtime base URL work at all.
	assertEquals(
		html.includes('"/_app/immutable/'),
		false,
		'page should not reference assets from the server root'
	);
	assertStringIncludes(html, '_app/immutable/');
});

test('assets referenced by a rendered page are served under the prefix', async () => {
	const client = new TestClient(ORIGIN);
	const pageUrl = `${ORIGIN}${BASE_URL}/auth/login`;
	const html = await (await client.get(`${BASE_URL}/auth/login`)).text();

	const match = html.match(/["'(]([^"'()]*_app\/immutable\/[^"'()]+\.js)["')]/);
	assertEquals(typeof match?.[1], 'string', 'expected an _app asset reference in the page');

	// Resolve exactly like the browser would, from the prefixed page URL.
	const resolved = new URL(match![1], pageUrl);
	assertStringIncludes(resolved.pathname, `${BASE_URL}/`);

	const assetRes = await client.get(resolved.pathname);
	assertEquals(assetRes.status, 200);
});

await run();
