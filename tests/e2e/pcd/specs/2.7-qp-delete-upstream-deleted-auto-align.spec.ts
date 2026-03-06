/**
 * 2.7 Quality Profile — local delete with upstream already deleted
 *
 * Setup: Local deletes QP. Upstream deletes the same QP.
 * Expected: Auto-align (no conflict). Local delete op is dropped.
 */
import { test } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, expectNoConflict } from '../helpers/conflicts';
import { openFirstQualityProfileGeneral, goToQualityProfileGeneral } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';

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

test.describe('2.7 QP local delete with upstream already deleted', () => {
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

	test('auto-align', async ({ page }) => {
		// Local deletes quality profile
		await deleteQualityProfile(page, localId, profileName);

		// Dev deletes the same quality profile
		await deleteQualityProfile(page, devId, profileName);

		// Push upstream delete
		await exportAndPush(page, devId, 'e2e: 2.7 qp delete upstream deleted');

		// Pull into local -> auto-align (no conflict)
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectNoConflict(page, profileName);
	});
});
