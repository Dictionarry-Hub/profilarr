/**
 * 3.7 Regular Expression — tags only, no conflict expected
 *
 * Local adds a tag to regex "3L". Dev changes the pattern on "3L".
 * Expected: No conflict — tag ops don't have value guards on pattern/name.
 * Tag applied and dev pattern applied.
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, expectNoConflict } from '../helpers/conflicts';
import { goToRegex, updateRegexPattern } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const REGEX_NAME = '3L';
const LOCAL_TAG = 'E2E-Tag-3-7';
const DEV_PATTERN = '\\bDEV_3_7\\b';

async function addTagAndSave(page: import('@playwright/test').Page, tag: string): Promise<void> {
	const input = page.locator('#tags-input');
	await input.fill(tag);
	await input.press('Enter');
	await page.getByRole('button', { name: 'Save Changes' }).click();
	await page.waitForLoadState('networkidle');
}

test.describe('3.7 Regex tags only — no conflict', () => {
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

	test('a) no conflict — tag applied and dev pattern applied', async ({ page }) => {
		// Local adds a tag
		await goToRegex(page, localId, REGEX_NAME);
		await addTagAndSave(page, LOCAL_TAG);

		// Dev changes pattern
		await goToRegex(page, devId, REGEX_NAME);
		await updateRegexPattern(page, DEV_PATTERN);

		await exportAndPush(page, devId, 'e2e: 3.7 tags no conflict');
		await pullChanges(page, localId);

		// No conflict expected
		await goToConflicts(page, localId);
		await expectNoConflict(page, REGEX_NAME);

		// Verify tag present and dev pattern applied
		await goToRegex(page, localId, REGEX_NAME);
		const pattern = await page.locator('#pattern').inputValue();
		expect(pattern).toBe(DEV_PATTERN);

		// Check tag is still present
		const tagElement = page.locator(`text=${LOCAL_TAG}`);
		await expect(tagElement.first()).toBeVisible();
	});
});
