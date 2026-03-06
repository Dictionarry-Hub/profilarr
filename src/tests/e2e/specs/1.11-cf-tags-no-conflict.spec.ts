/**
 * 1.11 Custom Format — tags-only update should not conflict
 *
 * Setup: User adds a tag to CF. Upstream changes description.
 * Expected: No conflict; tag op applies cleanly.
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, expectNoConflict } from '../helpers/conflicts';
import { goToCustomFormatGeneral, addCfTag, updateCfDescription } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';
const LOCAL_TAG = 'LocalTag';
const DEV_DESCRIPTION = 'Upstream description edit';

test.describe('1.11 CF tags-only no-conflict', () => {
	let localId: number;
	let devId: number;
	let devHead: string;

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

	test('no conflict when upstream changes description', async ({ page }) => {
		// Local adds a tag (tags-only)
		await goToCustomFormatGeneral(page, localId, TEST_CF_NAME);
		await addCfTag(page, LOCAL_TAG);
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await page.waitForLoadState('networkidle');

		// Dev changes description
		await goToCustomFormatGeneral(page, devId, TEST_CF_NAME);
		await updateCfDescription(page, DEV_DESCRIPTION);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.11 tags no conflict');

		// Local pulls
		await pullChanges(page, localId);

		// Verify no conflict
		await goToConflicts(page, localId);
		await expectNoConflict(page, TEST_CF_NAME);

		// Verify tag present and description updated
		await goToCustomFormatGeneral(page, localId, TEST_CF_NAME);
		await expect(page.getByText(LOCAL_TAG)).toBeVisible();
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(DEV_DESCRIPTION);
	});
});
