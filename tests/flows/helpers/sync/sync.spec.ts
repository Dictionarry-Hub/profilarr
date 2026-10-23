/**
 * Checks for the sync helpers in helpers/sync/sync.ts. syncSection runs on the
 * Delay Profiles section: it needs only one selection, and a rejected delay
 * profile fails the whole section. The setup helpers run against every target
 * that syncs quality profiles, so a new target is covered as soon as it's in
 * the registry.
 */
import { test, expect } from '$flows/helpers/core/test.ts';
import { fixture } from '$flows/helpers/core/fixtureData.ts';
import type { FakeArr, Resource } from '$flows/helpers/sync/fakeArr.ts';
import {
	addArrAndOpenSync,
	chooseDelayProfile,
	chooseMediaManagement,
	setUpProfileSync,
	syncRegion,
	syncSection
} from '$flows/helpers/sync/sync.ts';
import { targetsWith, type Target } from '$flows/helpers/sync/targets.ts';

test('syncSection waits for a sync that succeeds', async ({ page, fakeRadarr }) => {
	await addArrAndOpenSync(page, fakeRadarr);
	await chooseDelayProfile(page);
	const before = fakeRadarr.sent('PUT', '/api/v3/delayprofile/1').length;

	const result = await syncSection(page, 'Delay Profiles');

	expect(result.status).toBe('idle');
	expect(result.lastSyncedAt).not.toBeNull();
	// Checked once, not waited for: the sync must be done when syncSection returns
	expect(fakeRadarr.sent('PUT', '/api/v3/delayprofile/1')).toHaveLength(before + 1);
});

test('syncSection reports a sync that fails', async ({ page, fakeRadarr }) => {
	await addArrAndOpenSync(page, fakeRadarr);
	await chooseDelayProfile(page);
	fakeRadarr.fail('PUT', '/api/v3/delayprofile/1', 400);

	const result = await syncSection(page, 'Delay Profiles');

	expect(result.status).toBe('failed');
});

/** The fixtures profile written for this target's app, e.g. "Sonarr Profile" */
const profileFor = (target: Target) => fixture.qualityProfile(`${target.label} Profile`).name;

/** The profile the fake now holds, by name */
function heldProfile(fake: FakeArr, name: string): Resource {
	const profile = fake.collection('qualityprofile').find((candidate) => candidate.name === name);
	if (!profile) throw new Error(`${fake.target.id} holds no quality profile "${name}"`);
	return profile;
}

interface ProfileItem {
	quality?: { name: string };
	items?: ProfileItem[];
	minSize?: number | null;
	maxSize?: number | null;
	preferredSize?: number | null;
}

/** A quality's row in a profile, looking inside groups */
function qualityRow(items: ProfileItem[], name: string): ProfileItem | undefined {
	for (const item of items) {
		if (item.quality?.name === name) return item;
		const inside = qualityRow(item.items ?? [], name);
		if (inside) return inside;
	}
	return undefined;
}

for (const target of targetsWith('qualityProfiles')) {
	test.describe(target.id, () => {
		test('setUpProfileSync gets a quality profile ready to sync', async ({ page, startArr }) => {
			const fake = await startArr(target.id);
			const profile = profileFor(target);

			await setUpProfileSync(page, fake, { profiles: [profile] });
			const result = await syncSection(page, 'Quality Profiles');

			expect(result.status).toBe('idle');
			expect(heldProfile(fake, profile).name).toBe(profile);
			expect(fake.unhandled, 'the sync only called endpoints the fake supports').toEqual([]);
		});

		test('Quality Profiles only save after the other sections', async ({ page, startArr }) => {
			const fake = await startArr(target.id);
			await addArrAndOpenSync(page, fake);
			const save = syncRegion(page, 'Quality Profiles').getByRole('button', {
				name: 'Save',
				exact: true
			});
			await syncRegion(page, 'Quality Profiles')
				.getByRole('switch', { name: new RegExp(`^Toggle quality profile ${profileFor(target)} `) })
				.click();

			await expect(save, 'nothing else is saved yet').toBeDisabled();
			await chooseMediaManagement(page, fake);
			await expect(save, 'a delay profile is still missing').toBeDisabled();
			await chooseDelayProfile(page);
			if (target.capabilities.includes('profileSizes')) {
				await expect(save, 'the global quality definition is still missing').toBeDisabled();
			} else {
				await expect(save).toBeEnabled();
			}
		});
	});
}

for (const target of targetsWith('profileSizes')) {
	test(`${target.id} gets the chosen quality definition sizes on its profile`, async ({
		page,
		startArr
	}) => {
		const fake = await startArr(target.id);
		const profile = profileFor(target);
		const config = fixture.qualityDefinitions(target.app, 'Fixture Sonarr');

		await setUpProfileSync(page, fake, { profiles: [profile], qualityDefinitions: config.name });
		await syncSection(page, 'Quality Profiles');

		const items = heldProfile(fake, profile).items as ProfileItem[];
		const sized = config.qualities.filter((q) => q.minSize || q.maxSize || q.preferredSize);
		expect(sized.length, 'the fixtures config sets some sizes').toBeGreaterThan(0);
		for (const quality of sized) {
			const name = fixture.arrQualityName(target.app, quality.qualityName) ?? quality.qualityName;
			// The app sends the config's sizes as they are, with 0 (no limit) as null
			expect(pickSizes(qualityRow(items, name)), `${name} sizes`).toEqual({
				minSize: quality.minSize || null,
				maxSize: quality.maxSize || null,
				preferredSize: quality.preferredSize || null
			});
		}
	});
}

function pickSizes(row: ProfileItem | undefined) {
	return {
		minSize: row?.minSize ?? null,
		maxSize: row?.maxSize ?? null,
		preferredSize: row?.preferredSize ?? null
	};
}
