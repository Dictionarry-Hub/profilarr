import { test, expect } from '$flows/helpers/fixtures.ts';
import { addArr } from '$flows/helpers/arrs.ts';
import type { FakeArr } from '$flows/helpers/fakeArr.ts';

/** What adding an instance should have sent the fake */
function expectAddedTo(fake: FakeArr) {
	const paths = fake.requests.map((r) => `${r.method} ${r.path}`);
	expect(paths, 'the connection test reads the API version and status').toEqual(
		expect.arrayContaining(['GET /api', 'GET /api/v3/system/status'])
	);
	expect(paths, 'saving applies the default delay profile').toContain('PUT /api/v3/delayprofile/1');
	expect(fake.unhandled, 'Profilarr only called endpoints the fake supports').toEqual([]);
}

test('addArr adds a Radarr instance', async ({ page, fakeRadarr }) => {
	await addArr(page, { name: 'Fake Radarr', fake: fakeRadarr });
	expectAddedTo(fakeRadarr);
});

test('addArr adds a Sonarr instance', async ({ page, fakeSonarr }) => {
	await addArr(page, { name: 'Fake Sonarr', fake: fakeSonarr });
	expectAddedTo(fakeSonarr);
});

test('addArr adds a second instance once the list has one', async ({
	page,
	fakeRadarr,
	fakeSonarr
}) => {
	await addArr(page, { name: 'Fake Radarr', fake: fakeRadarr });
	await addArr(page, { name: 'Fake Sonarr', fake: fakeSonarr });
	await expect(page.getByRole('main').getByText('Fake Radarr', { exact: true })).toBeVisible();
});
