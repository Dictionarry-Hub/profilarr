/**
 * 2.32 Quality Profile — minimum custom format score conflict
 *
 * Setup: Local changes minimum_custom_format_score to current+10.
 *        Upstream changes it to current+20.
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

/** Read the current minimum score value. */
async function getMinimumScore(page: import('@playwright/test').Page): Promise<number> {
	const input = page.locator('input[name="minimumScore"]:not([type="hidden"])');
	return Number(await input.inputValue());
}

/** Set the minimum score and save. */
async function setMinimumScoreAndSave(
	page: import('@playwright/test').Page,
	value: number
): Promise<void> {
	const input = page.locator('input[name="minimumScore"]:not([type="hidden"])');
	await input.fill(String(value));
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');
}

test.describe('2.32 QP minimum custom format score conflict', () => {
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

	test('a) override — local minimum score wins', async ({ page }) => {
		// Read original value
		await goToQualityProfileScoring(page, localId, profileName);
		const original = await getMinimumScore(page);
		const localValue = original + 10;
		const devValue = original + 20;

		// Local: change minimum score
		await setMinimumScoreAndSave(page, localValue);

		// Dev: change minimum score to a different value
		await goToQualityProfileScoring(page, devId, profileName);
		await setMinimumScoreAndSave(page, devValue);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.32 qp scoring minimum score conflict');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: local value wins
		await goToQualityProfileScoring(page, localId, profileName);
		expect(await getMinimumScore(page)).toBe(localValue);
	});

	test('b) align — upstream minimum score wins', async ({ page }) => {
		// Read original value
		await goToQualityProfileScoring(page, localId, profileName);
		const original = await getMinimumScore(page);
		const localValue = original + 10;
		const devValue = original + 20;

		// Local: change minimum score
		await setMinimumScoreAndSave(page, localValue);

		// Dev: change minimum score to a different value
		await goToQualityProfileScoring(page, devId, profileName);
		await setMinimumScoreAndSave(page, devValue);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.32 qp scoring minimum score conflict');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream value wins
		await goToQualityProfileScoring(page, localId, profileName);
		expect(await getMinimumScore(page)).toBe(devValue);
	});
});
