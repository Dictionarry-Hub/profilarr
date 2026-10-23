/**
 * Checks for the fake itself, over plain HTTP. These don't start the app.
 * Starting state is checked for every target; behaviour, which every target
 * shares through its resource kinds, on the default Radarr.
 */
import { test, expect } from '$flows/helpers/core/test.ts';
import type { FakeArr } from '$flows/helpers/sync/fakeArr.ts';
import { TARGETS, targetsWith } from '$flows/helpers/sync/targets.ts';

function call(fake: FakeArr, method: string, path: string, body?: unknown, apiKey = fake.apiKey) {
	return fetch(`${fake.url}${path}`, {
		method,
		headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

for (const target of TARGETS) {
	test.describe(target.id, () => {
		test('starts like a fresh install', async ({ startArr }) => {
			const fake = await startArr(target.id);
			const status = await (await call(fake, 'GET', `${target.apiBase}/system/status`)).json();
			expect(status.appName).toBe(target.label);
			expect(status.version, `the recording is ${target.label} ${target.major}`).toMatch(
				new RegExp(`^${target.major}\\.`)
			);
			const profiles = await (await call(fake, 'GET', `${target.apiBase}/qualityprofile`)).json();
			expect(profiles.length, 'a fresh install has default quality profiles').toBeGreaterThan(0);
		});

		test('rejects a wrong API key', async ({ startArr }) => {
			const fake = await startArr(target.id);
			const response = await call(fake, 'GET', `${target.apiBase}/system/status`, undefined, 'no');
			expect(response.status).toBe(401);
		});
	});
}

for (const target of targetsWith('profileSizes')) {
	test(`${target.id} reports an API that keeps sizes on profiles`, async ({ startArr }) => {
		const fake = await startArr(target.id);
		const api = await (await call(fake, 'GET', '/api')).json();
		expect(Number(api.current.replace(/^v/, ''))).toBeGreaterThanOrEqual(5);
		const [profile] = await (await call(fake, 'GET', `${target.apiBase}/qualityprofile`)).json();
		expect(profile.items[0]).toHaveProperty('maxSize');
	});
}

test('a collection keeps what Profilarr creates and records it', async ({ fakeRadarr }) => {
	const created = await call(fakeRadarr, 'POST', '/api/v3/customformat', { name: 'Title Match' });
	expect(created.status).toBe(201);
	const { id } = await created.json();

	await call(fakeRadarr, 'PUT', `/api/v3/customformat/${id}`, {
		name: 'Title Match',
		includeCustomFormatWhenRenaming: true
	});
	expect(fakeRadarr.collection('customformat')).toEqual([
		{ id, name: 'Title Match', includeCustomFormatWhenRenaming: true }
	]);
	expect(fakeRadarr.sent('POST', '/api/v3/customformat')).toEqual([{ name: 'Title Match' }]);
});

test('a singleton and a bulk resource keep their updates', async ({ fakeRadarr }) => {
	const naming = fakeRadarr.singleton('config/naming');
	await call(fakeRadarr, 'PUT', `/api/v3/config/naming/${naming.id}`, {
		...naming,
		renameMovies: true
	});
	expect(fakeRadarr.singleton('config/naming')).toMatchObject({ renameMovies: true });

	const [first] = fakeRadarr.collection('qualitydefinition');
	await call(fakeRadarr, 'PUT', '/api/v3/qualitydefinition/update', [{ id: first.id, maxSize: 7 }]);
	expect(fakeRadarr.collection('qualitydefinition')[0]).toMatchObject({ id: first.id, maxSize: 7 });
});

test('naming an unknown resource fails with the target id', async ({ fakeRadarr }) => {
	expect(() => fakeRadarr.collection('nothing')).toThrow('radarr-6 has no collection "nothing"');
});

test('the fake can reject or fail on purpose', async ({ fakeRadarr }) => {
	fakeRadarr.reject('customformat', 'Bad Format');
	expect(
		(await call(fakeRadarr, 'POST', '/api/v3/customformat', { name: 'Bad Format' })).status
	).toBe(400);

	fakeRadarr.fail('GET', '/api/v3/qualityprofile', 500);
	expect((await call(fakeRadarr, 'GET', '/api/v3/qualityprofile')).status).toBe(500);

	fakeRadarr.fail('PUT', /^\/api\/v3\/tag\/\d+$/, 503);
	expect((await call(fakeRadarr, 'PUT', '/api/v3/tag/9', {})).status).toBe(503);
});

test('the fake lists requests it has no route for', async ({ fakeRadarr }) => {
	expect((await call(fakeRadarr, 'GET', '/api/v3/nothing-here')).status).toBe(404);
	expect(fakeRadarr.unhandled.map((r) => r.path)).toEqual(['/api/v3/nothing-here']);
});

test('sent matches a path pattern, for paths with ids', async ({ fakeRadarr }) => {
	const { id } = await (
		await call(fakeRadarr, 'POST', '/api/v3/customformat', { name: 'A' })
	).json();
	await call(fakeRadarr, 'PUT', `/api/v3/customformat/${id}`, { name: 'B' });
	expect(fakeRadarr.sent('PUT', /^\/api\/v3\/customformat\/\d+$/)).toEqual([{ name: 'B' }]);
});

test('waitFor waits for a request that arrives later', async ({ fakeRadarr }) => {
	const waiting = fakeRadarr.waitFor('POST', '/api/v3/customformat');
	await new Promise((r) => setTimeout(r, 100));
	await call(fakeRadarr, 'POST', '/api/v3/customformat', { name: 'Late' });
	const request = await waiting;
	expect(request.body).toEqual({ name: 'Late' });
	expect(request.status).toBe(201);
});

test('waitFor returns a request that already arrived', async ({ fakeRadarr }) => {
	await call(fakeRadarr, 'GET', '/api/v3/system/status');
	const request = await fakeRadarr.waitFor('GET', /system\/status$/);
	expect(request.status).toBe(200);
});

test('waitFor fails with the requests that did arrive', async ({ fakeRadarr }) => {
	await call(fakeRadarr, 'GET', '/api/v3/system/status');
	await expect(fakeRadarr.waitFor('PUT', '/api/v3/qualityprofile', 200)).rejects.toThrow(
		'Got: GET /api/v3/system/status'
	);
});
