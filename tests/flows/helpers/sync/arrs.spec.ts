import { test, expect } from '$flows/helpers/core/test.ts';
import { addArr, openArr } from '$flows/helpers/sync/arrs.ts';
import { openTab } from '$flows/helpers/core/nav.ts';
import type { FakeArr } from '$flows/helpers/sync/fakeArr.ts';
import { TARGETS } from '$flows/helpers/sync/targets.ts';

/** What adding an instance should have sent the fake */
function expectAddedTo(fake: FakeArr) {
	const paths = fake.requests.map((r) => `${r.method} ${r.path}`);
	expect(paths, 'the connection test reads the API version and status').toEqual(
		expect.arrayContaining(['GET /api', `GET ${fake.target.apiBase}/system/status`])
	);
	expect(paths, 'saving applies the default delay profile').toContain(
		`PUT ${fake.target.apiBase}/delayprofile/1`
	);
	expect(fake.unhandled, 'Profilarr only called endpoints the fake supports').toEqual([]);
}

for (const target of TARGETS) {
	test(`addArr adds a ${target.id} instance`, async ({ page, startArr }) => {
		const fake = await startArr(target.id);
		await addArr(page, { name: `Fake ${target.id}`, fake });
		expectAddedTo(fake);
	});
}

test('addArr adds a second instance once the list has one', async ({
	page,
	fakeRadarr,
	fakeSonarr
}) => {
	await addArr(page, { name: 'Fake Radarr', fake: fakeRadarr });
	await addArr(page, { name: 'Fake Sonarr', fake: fakeSonarr });
	await expect(page.getByRole('main').getByText('Fake Radarr', { exact: true })).toBeVisible();
});

test('openArr opens an instance and openTab walks its tabs', async ({ page, fakeRadarr }) => {
	await addArr(page, { name: 'Fake Radarr', fake: fakeRadarr });
	await openArr(page, 'Fake Radarr');
	for (const tab of [
		'Library',
		'Drift',
		'Upgrades',
		'Renames',
		'Logs',
		'Settings',
		'Sync'
	] as const) {
		await openTab(page, tab);
	}
	expect(fakeRadarr.unhandled, 'every tab only called endpoints the fake supports').toEqual([]);
});
