/**
 * 2.43 Quality Profile — local delete vs upstream general update
 *
 * Setup: Both sides have a QP. Local deletes it.
 *        Upstream updates description and pushes.
 * Expected: No conflict. Delete guard (name) still matches.
 *           Profile absent locally.
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, expectNoConflict } from '../helpers/conflicts';
import {
	openFirstQualityProfileGeneral,
	goToQualityProfileGeneral,
	updateQpDescription
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const DEV_DESCRIPTION = 'Upstream description update 2.43';

async function deleteQualityProfile(
	page: import('@playwright/test').Page,
	databaseId: number,
	name: string
): Promise<void> {
	await goToQualityProfileGeneral(page, databaseId, name);
	await page.getByRole('button', { name: 'Delete' }).first().click();
	await page.getByRole('button', { name: 'Delete' }).last().click();
	await page.waitForURL(new RegExp(`/quality-profiles/${databaseId}$`), { timeout: 15_000 });
	await page.waitForLoadState('networkidle');
}

async function expectQualityProfileMissing(
	page: import('@playwright/test').Page,
	databaseId: number,
	name: string
): Promise<void> {
	await page.goto(`/quality-profiles/${databaseId}`);
	await page.waitForLoadState('networkidle');
	await page.getByPlaceholder(/search/i).fill(name);
	await page.waitForTimeout(500);
	await expect(page.locator('table tbody tr', { hasText: name })).toHaveCount(0);
}

test.describe('2.43 QP local delete vs upstream general update', () => {
	test.describe.configure({ timeout: 120_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let profileName: string;

	test.beforeEach(async ({ browser }) => {
		const page = await browser.newPage();

		await unlinkPcdByName(page, LOCAL_DB_NAME);
		await unlinkPcdByName(page, DEV_DB_NAME);

		devId = await linkPcd(page, {
			name: DEV_DB_NAME,
			repoUrl: TEST_REPO_URL,
			pat: TEST_PAT,
			gitName: TEST_GIT_NAME,
			gitEmail: TEST_GIT_EMAIL
		});

		devHead = getHead(devId);

		localId = await linkPcd(page, {
			name: LOCAL_DB_NAME,
			repoUrl: TEST_REPO_URL,
			pat: TEST_PAT,
			gitName: TEST_GIT_NAME,
			gitEmail: TEST_GIT_EMAIL,
			syncStrategy: 'Manual (no auto-sync)',
			autoPull: false,
			localOpsEnabled: true,
			conflictStrategy: 'Ask every time'
		});

		profileName = await openFirstQualityProfileGeneral(page, localId);
		await page.close();
	});

	test.afterEach(async ({ browser }) => {
		if (devId && devHead) {
			try {
				resetToCommit(devId, devHead, true);
			} catch {
				// Best-effort reset
			}
		}

		const page = await browser.newPage();
		await unlinkPcdByName(page, LOCAL_DB_NAME);
		await unlinkPcdByName(page, DEV_DB_NAME);
		await page.close();
	});

	test('no conflict — delete remains effective', async ({ page }) => {
		// Local deletes quality profile
		await deleteQualityProfile(page, localId, profileName);

		// Dev updates description on the same profile
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpDescription(page, DEV_DESCRIPTION);

		// Push upstream update
		await exportAndPush(page, devId, 'e2e: 2.43 upstream description update');

		// Pull into local → no conflict expected
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectNoConflict(page, profileName);

		// Verify profile is absent locally
		await expectQualityProfileMissing(page, localId, profileName);
	});
});
