/**
 * 2.22 Quality Profile — local rename+scoring vs upstream scoring
 *
 * Setup: Local renames profile (general tab), then changes minimum score
 *        (scoring tab). Upstream also changes minimum score.
 * Conflict: guard_mismatch on minimum score — both sides changed it.
 *
 * a) Override → local name + local scoring
 * b) Align → local name kept + upstream scoring (only scoring op dropped;
 *    rename is a separate non-conflicting op that survives)
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
const LOCAL_SCORE_BUMP = 7;
const DEV_SCORE_BUMP = 13;

test.describe('2.22 QP local rename+scoring vs upstream scoring', () => {
	test.describe.configure({ timeout: 120_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let profileName: string;
	let originalMinimumScore: number;
	let localMinimumScore: number;
	let devMinimumScore: number;

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

	test('a) override — local name + local scoring', async ({ page }) => {
		const localName = `${profileName} Local 2.22`;

		// Local: rename profile on general tab
		await goToQualityProfileGeneral(page, localId, profileName);
		await updateQpName(page, localName);

		// Local: navigate to scoring tab directly (avoid list search after rename)
		const generalUrl = page.url();
		await page.goto(generalUrl.replace(/\/general$/, '/scoring'));
		await page.waitForLoadState('networkidle');
		const minimumScoreInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		originalMinimumScore = Number(await minimumScoreInput.inputValue());
		localMinimumScore = originalMinimumScore + LOCAL_SCORE_BUMP;
		await minimumScoreInput.fill(String(localMinimumScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: change minimum score to a different value
		await goToQualityProfileScoring(page, devId, profileName);
		const devInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		devMinimumScore = originalMinimumScore + DEV_SCORE_BUMP;
		await devInput.fill(String(devMinimumScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.22 qp local rename+scoring vs upstream scoring');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, localName);

		// Override
		await overrideConflict(page, localName);

		// Verify: local name + local scoring
		await goToQualityProfileGeneral(page, localId, localName);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(localName);

		await goToQualityProfileScoring(page, localId, localName);
		const finalMinimum = Number(
			await page.locator('input[name="minimumScore"]:not([type="hidden"])').inputValue()
		);
		expect(finalMinimum).toBe(localMinimumScore);
	});

	test('b) align — local name kept + upstream scoring', async ({ page }) => {
		const localName = `${profileName} Local 2.22`;

		// Local: rename profile on general tab
		await goToQualityProfileGeneral(page, localId, profileName);
		await updateQpName(page, localName);

		// Local: navigate to scoring tab directly (avoid list search after rename)
		const generalUrl = page.url();
		await page.goto(generalUrl.replace(/\/general$/, '/scoring'));
		await page.waitForLoadState('networkidle');
		const minimumScoreInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		originalMinimumScore = Number(await minimumScoreInput.inputValue());
		localMinimumScore = originalMinimumScore + LOCAL_SCORE_BUMP;
		await minimumScoreInput.fill(String(localMinimumScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: change minimum score to a different value
		await goToQualityProfileScoring(page, devId, profileName);
		const devInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		devMinimumScore = originalMinimumScore + DEV_SCORE_BUMP;
		await devInput.fill(String(devMinimumScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.22 qp local rename+scoring vs upstream scoring');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, localName);

		// Align
		await alignConflict(page, localName);

		// Verify: only scoring op dropped — rename survives (non-conflicting).
		// Same behavior as 2.21: rename and scoring are independent ops.
		await goToQualityProfileGeneral(page, localId, localName);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(localName);

		await goToQualityProfileScoring(page, localId, localName);
		const finalMinimum = Number(
			await page.locator('input[name="minimumScore"]:not([type="hidden"])').inputValue()
		);
		expect(finalMinimum).toBe(devMinimumScore);
	});
});
