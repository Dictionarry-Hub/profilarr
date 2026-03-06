/**
 * 2.5 Quality Profile — local qualities-only vs upstream scoring-only
 *
 * Setup: Local edits qualities only. Upstream edits scoring only.
 * Expected: No conflict. Local qualities change persists and upstream scoring applies.
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, expectNoConflict } from '../helpers/conflicts';
import {
	openFirstQualityProfileGeneral,
	goToQualityProfileQualities,
	goToQualityProfileScoring
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';

test.describe('2.5 QP local qualities-only vs upstream scoring-only', () => {
	test.describe.configure({ timeout: 120_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let profileName: string;
	let targetQualityName: string;
	let localEnabledValue: boolean;
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

	test('no conflict', async ({ page }) => {
		// Local: qualities-only update (toggle enabled state of a non-upgrade-until row)
		await goToQualityProfileQualities(page, localId, profileName);
		const rows = page.locator('div.space-y-4 > div[role="button"]');
		await expect(rows.first()).toBeVisible();

		const rowCount = await rows.count();
		let targetRow = rows.first();
		for (let i = 0; i < rowCount; i++) {
			const candidate = rows.nth(i);
			const upgradeUntilChecked =
				(await candidate.locator('[role="checkbox"]').first().getAttribute('aria-checked')) ===
				'true';
			if (!upgradeUntilChecked) {
				targetRow = candidate;
				break;
			}
		}

		targetQualityName = (await targetRow.locator('div.font-medium').first().innerText()).trim();
		const initialEnabled =
			(await targetRow.locator('[role="checkbox"]').last().getAttribute('aria-checked')) === 'true';

		await targetRow.click();
		localEnabledValue = !initialEnabled;
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: scoring-only update (minimum score)
		await goToQualityProfileScoring(page, devId, profileName);
		const minimumScoreInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		const currentMinimum = Number(await minimumScoreInput.inputValue());
		devMinimumScore = currentMinimum + 9;
		await minimumScoreInput.fill(String(devMinimumScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream change
		await exportAndPush(page, devId, 'e2e: 2.5 qp local qualities vs upstream scoring');

		// Pull into local
		await pullChanges(page, localId);

		// Verify no conflict row
		await goToConflicts(page, localId);
		await expectNoConflict(page, profileName);

		// Verify local qualities change
		await goToQualityProfileQualities(page, localId, profileName);
		const finalRow = page
			.locator('div.space-y-4 > div[role="button"]')
			.filter({ has: page.locator('div.font-medium', { hasText: targetQualityName }) })
			.first();
		await expect(finalRow).toBeVisible();
		const finalEnabled =
			(await finalRow.locator('[role="checkbox"]').last().getAttribute('aria-checked')) === 'true';
		expect(finalEnabled).toBe(localEnabledValue);

		// Verify upstream scoring change
		await goToQualityProfileScoring(page, localId, profileName);
		const finalMinimum = Number(await minimumScoreInput.inputValue());
		expect(finalMinimum).toBe(devMinimumScore);
	});
});
