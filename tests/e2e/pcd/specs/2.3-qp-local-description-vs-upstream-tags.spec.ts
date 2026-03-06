/**
 * 2.3 Quality Profile — local description vs upstream tags
 *
 * Setup: Local edits description only. Upstream edits tags only.
 * Expected: No conflict. Local description persists and upstream tag applies.
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
	updateQpDescription,
	addQpTag
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const LOCAL_DESCRIPTION = 'E2E 2.3 local description edit';
const DEV_TAG = 'E2E-QP-2-3-DevTag';

test.describe('2.3 QP local description vs upstream tags', () => {
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

	test('no conflict', async ({ page }) => {
		// Local: description-only update
		await goToQualityProfileGeneral(page, localId, profileName);
		await updateQpDescription(page, LOCAL_DESCRIPTION);

		// Dev: tags-only update
		await goToQualityProfileGeneral(page, devId, profileName);
		await addQpTag(page, DEV_TAG);
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream change
		await exportAndPush(page, devId, 'e2e: 2.3 qp local description vs upstream tags');

		// Pull into local
		await pullChanges(page, localId);

		// Verify no conflict row
		await goToConflicts(page, localId);
		await expectNoConflict(page, profileName);

		// Verify local description + upstream tag
		await goToQualityProfileGeneral(page, localId, profileName);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(LOCAL_DESCRIPTION);
		await expect(page.getByText(DEV_TAG)).toBeVisible();
	});
});
