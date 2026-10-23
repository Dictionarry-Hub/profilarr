/**
 * Checks for the sync helper in helpers/sync.ts, using the Delay Profiles
 * section: it needs only one selection, and a rejected delay profile fails
 * the whole section.
 */
import { test, expect, FIXTURES_NAME } from '$flows/helpers/test.ts';
import { addArr, openArr } from '$flows/helpers/arrs.ts';
import { saveForm } from '$flows/helpers/forms.ts';
import { openTab } from '$flows/helpers/nav.ts';
import { syncSection } from '$flows/helpers/sync.ts';
import type { FakeArr } from '$flows/helpers/fakeArr.ts';
import type { Page } from '@playwright/test';

/** Add the fake, pick a delay profile on its Sync page and save it */
async function chooseDelayProfile(page: Page, fake: FakeArr) {
	await addArr(page, { name: 'Fake Radarr', fake });
	await openArr(page, 'Fake Radarr');
	await openTab(page, 'Sync');
	const region = page.getByRole('main').getByRole('region', { name: 'Delay Profiles' });
	await region
		.getByRole('switch', { name: `Toggle delay profile Prefer Usenet from ${FIXTURES_NAME}` })
		.click();
	await saveForm(page, { within: region, action: 'saveDelayProfiles' });
}

test('syncSection waits for a sync that succeeds', async ({ page, fakeRadarr }) => {
	await chooseDelayProfile(page, fakeRadarr);
	const before = fakeRadarr.sent('PUT', '/api/v3/delayprofile/1').length;

	const result = await syncSection(page, 'Delay Profiles');

	expect(result.status).toBe('idle');
	expect(result.lastSyncedAt).not.toBeNull();
	// Checked once, not waited for: the sync must be done when syncSection returns
	expect(fakeRadarr.sent('PUT', '/api/v3/delayprofile/1')).toHaveLength(before + 1);
});

test('syncSection reports a sync that fails', async ({ page, fakeRadarr }) => {
	await chooseDelayProfile(page, fakeRadarr);
	fakeRadarr.fail('PUT', '/api/v3/delayprofile/1', 400);

	const result = await syncSection(page, 'Delay Profiles');

	expect(result.status).toBe('failed');
});
