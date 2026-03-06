/**
 * 2.19 Quality Profile — upstream rename + local scoring conflict
 *
 * Setup: Local changes minimum score on the scoring tab. Upstream renames
 *        the profile.
 * Conflict: guard_mismatch — user's scoring UPDATE guards on the old name,
 *           which upstream changed.
 *
 * a) Override → upstream name + local scoring
 * b) Align → upstream name + upstream scoring, user op dropped
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import {
	goToConflicts,
	expectConflict,
	overrideConflict,
	alignConflict
} from '../helpers/conflicts';
import {
	openFirstQualityProfileGeneral,
	goToQualityProfileGeneral,
	goToQualityProfileScoring,
	updateQpName
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const SCORE_BUMP = 7;

test.describe('2.19 QP upstream rename + local scoring conflict', () => {
	test.describe.configure({ timeout: 120_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let profileName: string;
	let originalMinimumScore: number;
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

	test('a) override — upstream name + local scoring', async ({ page }) => {
		const devName = `${profileName} Dev 2.19`;

		// Local: change minimum score on scoring tab
		await goToQualityProfileScoring(page, localId, profileName);
		const minimumScoreInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		originalMinimumScore = Number(await minimumScoreInput.inputValue());
		localMinimumScore = originalMinimumScore + SCORE_BUMP;
		await minimumScoreInput.fill(String(localMinimumScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: rename the profile
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpName(page, devName);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.19 qp upstream rename + local scoring');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: upstream name kept
		await goToQualityProfileGeneral(page, localId, devName);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(devName);

		// Verify: local scoring applied
		await goToQualityProfileScoring(page, localId, devName);
		const finalMinimum = Number(
			await page.locator('input[name="minimumScore"]:not([type="hidden"])').inputValue()
		);
		expect(finalMinimum).toBe(localMinimumScore);
	});

	test('b) align — upstream name + upstream scoring', async ({ page }) => {
		const devName = `${profileName} Dev 2.19`;

		// Local: change minimum score on scoring tab
		await goToQualityProfileScoring(page, localId, profileName);
		const minimumScoreInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		originalMinimumScore = Number(await minimumScoreInput.inputValue());
		localMinimumScore = originalMinimumScore + SCORE_BUMP;
		await minimumScoreInput.fill(String(localMinimumScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: rename the profile
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpName(page, devName);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.19 qp upstream rename + local scoring');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream name kept
		await goToQualityProfileGeneral(page, localId, devName);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(devName);

		// Verify: scoring reverted to original (user op dropped)
		await goToQualityProfileScoring(page, localId, devName);
		const finalMinimum = Number(
			await page.locator('input[name="minimumScore"]:not([type="hidden"])').inputValue()
		);
		expect(finalMinimum).toBe(originalMinimumScore);
	});
});
