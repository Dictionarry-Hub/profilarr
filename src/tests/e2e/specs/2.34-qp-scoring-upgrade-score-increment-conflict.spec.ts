/**
 * 2.34 Quality Profile — upgrade_score_increment conflict
 *
 * Setup: Local changes upgrade_score_increment to current+5.
 *        Upstream changes it to current+15.
 * Conflict: guard_mismatch — both sides changed the same field.
 *
 * a) Override → local value wins
 * b) Align → upstream value wins
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
import { openFirstQualityProfileGeneral, goToQualityProfileScoring } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';

/** Read the current upgrade score increment value. */
async function getUpgradeScoreIncrement(page: import('@playwright/test').Page): Promise<number> {
	const input = page.locator('input[name="upgradeScoreIncrement"]:not([type="hidden"])');
	return Number(await input.inputValue());
}

/** Set the upgrade score increment and save. */
async function setUpgradeScoreIncrementAndSave(
	page: import('@playwright/test').Page,
	value: number
): Promise<void> {
	const input = page.locator('input[name="upgradeScoreIncrement"]:not([type="hidden"])');
	await input.fill(String(value));
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');
}

test.describe('2.34 QP upgrade score increment conflict', () => {
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

	test('a) override — local upgrade score increment wins', async ({ page }) => {
		await goToQualityProfileScoring(page, localId, profileName);
		const original = await getUpgradeScoreIncrement(page);
		const localValue = original + 5;
		const devValue = original + 15;

		// Local: change upgrade score increment
		await setUpgradeScoreIncrementAndSave(page, localValue);

		// Dev: change to a different value
		await goToQualityProfileScoring(page, devId, profileName);
		await setUpgradeScoreIncrementAndSave(page, devValue);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.34 qp scoring upgrade score increment conflict');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: local value wins
		await goToQualityProfileScoring(page, localId, profileName);
		expect(await getUpgradeScoreIncrement(page)).toBe(localValue);
	});

	test('b) align — upstream upgrade score increment wins', async ({ page }) => {
		await goToQualityProfileScoring(page, localId, profileName);
		const original = await getUpgradeScoreIncrement(page);
		const localValue = original + 5;
		const devValue = original + 15;

		// Local: change upgrade score increment
		await setUpgradeScoreIncrementAndSave(page, localValue);

		// Dev: change to a different value
		await goToQualityProfileScoring(page, devId, profileName);
		await setUpgradeScoreIncrementAndSave(page, devValue);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.34 qp scoring upgrade score increment conflict');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream value wins
		await goToQualityProfileScoring(page, localId, profileName);
		expect(await getUpgradeScoreIncrement(page)).toBe(devValue);
	});
});
