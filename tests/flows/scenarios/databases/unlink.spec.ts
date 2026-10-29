/**
 * - Protects: unlinking a database an Arr syncs from. The unlink cascades
 *   through the Arr's sync selections, so the Arr keeps no setup that points
 *   at the missing database.
 * - What the Arr already received stays: the unlink sends the Arr nothing.
 */
import { test, expect, FIXTURES_NAME } from '#flows/helpers/core/test.ts';
import { fixture } from '#flows/helpers/core/fixtureData.ts';
import { scheduledJobs } from '#flows/helpers/core/jobs.ts';
import { openTab, sidebar } from '#flows/helpers/core/nav.ts';
import { pageData } from '#flows/helpers/core/pageData.ts';
import { databasesApi, unlinkDatabase } from '#flows/helpers/git/databases.ts';
import { arrInstance, openArr } from '#flows/helpers/sync/arrs.ts';
import {
	arrSyncStatus,
	setUpProfileSync,
	syncRegion,
	syncSection
} from '#flows/helpers/sync/sync.ts';

const PROFILE = fixture.qualityProfile('Radarr Profile');

/** One database on the Databases page */
interface DatabaseSummary {
	id: number;
	name: string;
	/** How many Arr instances sync anything from it */
	linkedArrCount: number;
}

/**
 * Flow:
 * 1. The user sets up the fake Radarr to sync the fixtures' Radarr profile.
 * 2. The user syncs Quality Profiles.
 * 3. The user unlinks Fixtures from the Databases page.
 * 4. The user opens the Arr's Sync tab.
 *
 * Expects:
 * - before the unlink, the Databases page counts one linked Arr, and no
 *   pcd.sync job is scheduled for Fixtures
 * - after the unlink, the Arr has no quality profiles selected and no delay
 *   profile or media management configured. Relinking doesn't bring them back.
 * - the Arr is still in the status and the sidebar
 * - the Arr still holds the synced profile, and got no DELETE after the unlink
 * - the Sync page's Delay Profiles section shows "No databases configured"
 */
test("unlinking clears the Arr's sync setup and keeps what it already synced", async ({
	page,
	fakeRadarr
}) => {
	await setUpProfileSync(page, fakeRadarr, { profiles: [PROFILE.name] });
	expect((await syncSection(page, 'Quality Profiles')).status, 'The profile should sync').toBe(
		'idle'
	);
	const arr = await arrInstance(page, `Fake ${fakeRadarr.target.label}`);

	const database = (await databasesApi.list(page.request)).find((db) => db.name === FIXTURES_NAME);
	if (!database) throw new Error(`GET /api/v1/databases lists no ${FIXTURES_NAME}`);
	const { databases } = await pageData<{ databases: DatabaseSummary[] }>(page, '/databases');
	expect(
		databases.find((db) => db.id === database.id)?.linkedArrCount,
		`The Databases page should count one Arr syncing from ${FIXTURES_NAME}`
	).toBe(1);
	expect(
		(await scheduledJobs(page)).map((job) => job.description),
		`No pcd.sync job should be scheduled for ${FIXTURES_NAME}`
	).not.toContain(`pcd.sync:${database.id}`);
	expect(
		(await arrSyncStatus(page, arr.id)).sync.qualityProfiles.count,
		'The Arr should sync one profile before the unlink'
	).toBe(1);

	const requestsBefore = fakeRadarr.requests.length;
	await unlinkDatabase(page, { from: 'cards' });

	const { name, sync } = await arrSyncStatus(page, arr.id);
	expect(
		{
			qualityProfiles: sync.qualityProfiles.count,
			delayProfiles: sync.delayProfiles.configured,
			mediaManagement: sync.mediaManagement.configured
		},
		"The unlink should clear the Arr's sync setup"
	).toEqual({ qualityProfiles: 0, delayProfiles: false, mediaManagement: false });
	expect(name, 'The Arr should still be in the status').toBe(arr.name);
	await expect(
		sidebar(page).getByRole('link', { name: arr.name, exact: true }),
		'The sidebar should still list the Arr'
	).toBeVisible();

	await openArr(page, arr.name);
	await openTab(page, 'Sync');
	await expect(
		syncRegion(page, 'Delay Profiles').getByText('No databases configured', { exact: true }),
		'Delay Profiles should show that no database is configured'
	).toBeVisible();

	expect(
		fakeRadarr.collection('qualityprofile').map((profile) => profile.name),
		'The Arr should keep the synced profile'
	).toContain(PROFILE.name);
	expect(
		fakeRadarr.requests
			.slice(requestsBefore)
			.filter((request) => request.method === 'DELETE')
			.map((request) => request.path),
		'The Arr should get no DELETE after the unlink'
	).toEqual([]);
});
