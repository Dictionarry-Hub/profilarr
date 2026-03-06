/**
 * 2.25 Quality Profile — tags overlap merge (no conflict)
 *
 * Setup: Local adds tag "e2e-local". Upstream adds tag "e2e-upstream".
 *        Tag ops use per-tag INSERT/DELETE SQL — non-overlapping changes
 *        don't conflict.
 *
 * Expected: No conflict. Both tags present after pull.
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { getConflictCount, goToConflicts } from '../helpers/conflicts';
import { openFirstQualityProfileGeneral, goToQualityProfileGeneral } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const LOCAL_TAG = 'e2e-local';
const DEV_TAG = 'e2e-upstream';

/** Add a tag via the TagInput and save. */
async function addTagAndSave(page: import('@playwright/test').Page, tag: string): Promise<void> {
	const input = page.locator('#tags-input');
	await input.fill(tag);
	await input.press('Enter');
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');
}

test.describe('2.25 QP tags overlap merge (no conflict)', () => {
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

	test('no conflict — both tags present after pull', async ({ page }) => {
		// Local: add a tag
		await goToQualityProfileGeneral(page, localId, profileName);
		await addTagAndSave(page, LOCAL_TAG);

		// Dev: add a different tag
		await goToQualityProfileGeneral(page, devId, profileName);
		await addTagAndSave(page, DEV_TAG);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.25 qp tags overlap merge');

		// Pull into local → no conflict
		await pullChanges(page, localId);

		// Verify no conflicts
		await goToConflicts(page, localId);
		const count = await getConflictCount(page);
		expect(count).toBe(0);

		// Verify both tags present
		await goToQualityProfileGeneral(page, localId, profileName);
		const tagBadges = page.locator('span.inline-flex');
		const allText = await tagBadges.allInnerTexts();
		const tagNames = allText.map((t) =>
			t
				.replace(/\s*×?\s*$/, '')
				.trim()
				.toLowerCase()
		);
		expect(tagNames).toContain(LOCAL_TAG);
		expect(tagNames).toContain(DEV_TAG);
	});
});
