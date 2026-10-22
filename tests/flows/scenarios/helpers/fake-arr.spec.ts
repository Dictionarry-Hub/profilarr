/**
 * Checks for the fake Arr itself, over plain HTTP. These don't start the app.
 */
import { test, expect } from '$flows/helpers/fixtures.ts';
import type { FakeArr } from '$flows/helpers/fakeArr.ts';

function call(fake: FakeArr, method: string, path: string, body?: unknown, apiKey = fake.apiKey) {
	return fetch(`${fake.url}${path}`, {
		method,
		headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

test('the fake Radarr starts like a fresh install', async ({ fakeRadarr }) => {
	const status = await (await call(fakeRadarr, 'GET', '/api/v3/system/status')).json();
	expect(status.appName).toBe('Radarr');
	const profiles = await (await call(fakeRadarr, 'GET', '/api/v3/qualityprofile')).json();
	expect(profiles.map((p: { name: string }) => p.name)).toContain('HD-1080p');
});

test('the fake Sonarr starts like a fresh install', async ({ fakeSonarr }) => {
	const status = await (await call(fakeSonarr, 'GET', '/api/v3/system/status')).json();
	expect(status.appName).toBe('Sonarr');
});

test('the fake keeps what Profilarr creates and records it', async ({ fakeRadarr }) => {
	const created = await call(fakeRadarr, 'POST', '/api/v3/customformat', { name: 'Title Match' });
	expect(created.status).toBe(201);
	const { id } = await created.json();

	await call(fakeRadarr, 'PUT', `/api/v3/customformat/${id}`, {
		name: 'Title Match',
		includeCustomFormatWhenRenaming: true
	});
	expect(fakeRadarr.collections.customformat).toEqual([
		{ id, name: 'Title Match', includeCustomFormatWhenRenaming: true }
	]);
	expect(fakeRadarr.sent('POST', '/api/v3/customformat')).toEqual([{ name: 'Title Match' }]);
});

test('the fake rejects a wrong API key', async ({ fakeRadarr }) => {
	const response = await call(fakeRadarr, 'GET', '/api/v3/system/status', undefined, 'wrong');
	expect(response.status).toBe(401);
});

test('the fake can reject or fail on purpose', async ({ fakeRadarr }) => {
	fakeRadarr.reject('customformat', 'Bad Format');
	expect(
		(await call(fakeRadarr, 'POST', '/api/v3/customformat', { name: 'Bad Format' })).status
	).toBe(400);

	fakeRadarr.fail('GET', '/api/v3/qualityprofile', 500);
	expect((await call(fakeRadarr, 'GET', '/api/v3/qualityprofile')).status).toBe(500);
});

test('the fake lists requests it has no route for', async ({ fakeRadarr }) => {
	expect((await call(fakeRadarr, 'GET', '/api/v3/nothing-here')).status).toBe(404);
	expect(fakeRadarr.unhandled.map((r) => r.path)).toEqual(['/api/v3/nothing-here']);
});
