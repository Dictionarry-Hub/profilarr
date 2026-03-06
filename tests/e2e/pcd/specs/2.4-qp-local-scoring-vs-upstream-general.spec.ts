/**
 * 2.4 Quality Profile — local scoring-only vs upstream general-only
 *
 * Setup: Local edits scoring only. Upstream edits general only.
 * Expected: No conflict. Local scoring persists and upstream general applies.
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
	goToQualityProfileScoring,
	updateQpDescription
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const DEV_DESCRIPTION = 'E2E 2.4 upstream general description edit';

test.describe('2.4 QP local scoring-only vs upstream general-only', () => {
	test.describe.configure({ timeout: 120_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let profileName: string;
	let localMinimumScore: number;

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
		// Local: scoring-only update (minimum score)
		await goToQualityProfileScoring(page, localId, profileName);
		const minimumScoreInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		const currentMinimum = Number(await minimumScoreInput.inputValue());
		localMinimumScore = currentMinimum + 7;
		await minimumScoreInput.fill(String(localMinimumScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: general-only update (description)
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpDescription(page, DEV_DESCRIPTION);

		// Push upstream change
		await exportAndPush(page, devId, 'e2e: 2.4 qp local scoring vs upstream general');

		// Pull into local
		await pullChanges(page, localId);

		// Verify no conflict row
		await goToConflicts(page, localId);
		await expectNoConflict(page, profileName);

		// Verify upstream general change
		await goToQualityProfileGeneral(page, localId, profileName);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(DEV_DESCRIPTION);

		// Verify local scoring change
		await goToQualityProfileScoring(page, localId, profileName);
		const finalMinimum = Number(await minimumScoreInput.inputValue());
		expect(finalMinimum).toBe(localMinimumScore);
	});
});
