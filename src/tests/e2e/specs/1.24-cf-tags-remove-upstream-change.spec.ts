/**
 * 1.24 Custom Format — tag removal with upstream tag changes (no conflict)
 *
 * Setup: User removes a tag. Upstream adds a different tag.
 * Expected: No conflict. Final tags reflect upstream changes + user removal.
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, expectNoConflict } from '../helpers/conflicts';
import { goToCustomFormatGeneral, addCfTag, removeCfTag } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';

const TAG_REMOVE = 'E2E Tag Remove 1.24';
const TAG_KEEP = 'E2E Tag Keep 1.24';
const TAG_DEV = 'E2E Tag Dev 1.24';

function getTagContainer(page: import('@playwright/test').Page) {
	return page.locator('#tags-input').locator('xpath=ancestor::div[contains(@class,"flex")]');
}

test.describe('1.24 CF tags remove upstream change', () => {
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

	test('no conflict when tags diverge', async ({ page }) => {
		// Dev seeds tags
		await goToCustomFormatGeneral(page, devId, TEST_CF_NAME);
		await addCfTag(page, TAG_REMOVE);
		await addCfTag(page, TAG_KEEP);
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await page.waitForLoadState('networkidle');
		await exportAndPush(page, devId, 'e2e: 1.24 seed tags');

		// Local pulls
		await pullChanges(page, localId);

		// Local removes a tag
		await goToCustomFormatGeneral(page, localId, TEST_CF_NAME);
		await removeCfTag(page, TAG_REMOVE);
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await page.waitForLoadState('networkidle');

		// Dev adds another tag
		await goToCustomFormatGeneral(page, devId, TEST_CF_NAME);
		await addCfTag(page, TAG_DEV);
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await page.waitForLoadState('networkidle');
		await exportAndPush(page, devId, 'e2e: 1.24 upstream tag change');

		// Local pulls → no conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectNoConflict(page, TEST_CF_NAME);

		// Verify tag merge outcome
		await goToCustomFormatGeneral(page, localId, TEST_CF_NAME);
		const tagContainer = getTagContainer(page);
		await expect(tagContainer.getByText(TAG_KEEP)).toBeVisible();
		await expect(tagContainer.getByText(TAG_DEV)).toBeVisible();
		await expect(tagContainer.locator('span', { hasText: TAG_REMOVE })).toHaveCount(0);
	});
});
