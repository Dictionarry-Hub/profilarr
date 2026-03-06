/**
 * 2.8 Quality Profile — local delete with upstream renamed
 *
 * Setup: Local deletes QP. Upstream renames the same QP.
 * Expected: Auto-align (no conflict). QP remains with upstream renamed name.
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
	updateQpName
} from '../helpers/entity';
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

test.describe('2.8 QP local delete with upstream renamed', () => {
	test.describe.configure({ timeout: 120_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let profileName: string;
	let renamedProfileName: string;

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
		renamedProfileName = `${profileName} Dev Rename 2.8 ${Date.now()}`;
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

		// Dev renames the same quality profile
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpName(page, renamedProfileName);

		// Push upstream rename
		await exportAndPush(page, devId, 'e2e: 2.8 qp delete upstream renamed');

		// Pull into local -> auto-align (no conflict)
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectNoConflict(page, profileName);
		await expectNoConflict(page, renamedProfileName);

		// Verify renamed profile remains
		await goToQualityProfileGeneral(page, localId, renamedProfileName);
		const finalName = await page.locator('#name').inputValue();
		expect(finalName).toBe(renamedProfileName);
	});
});
