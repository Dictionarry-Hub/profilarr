/**
 * 2.35 Quality Profile — CF score same row (custom_format_name + arr_type) conflict
 *
 * Setup: Local changes the score of an enabled CF row to current+10.
 *        Upstream changes the same CF row's score to current+20.
 *        Both modify the same (custom_format_name, arr_type) row in
 *        quality_profile_cf_scores.
 * Conflict: guard_mismatch — both sides changed the score value.
 *
 * a) Override → local score wins
 * b) Align → upstream score wins
 */
import type { Locator, Page } from '@playwright/test';
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

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Find the first enabled scoring row and return its format name + cell locators. */
async function findFirstEnabledScoringRow(page: Page): Promise<{
	formatName: string;
	scoreInput: Locator;
}> {
	const rows = page.locator('table tbody tr');
	await expect(rows.first()).toBeVisible({ timeout: 15_000 });

	const count = await rows.count();
	for (let i = 0; i < count; i++) {
		const row = rows.nth(i);
		const nameCell = row.locator('td').first();
		const text = (await nameCell.innerText()).trim();
		if (!text) continue;

		const scoreCell = row.locator('td').nth(1);
		const enabledCheckbox = scoreCell.locator('[role="checkbox"]').first();
		const scoreInput = scoreCell.locator('input[type="number"]').first();
		if (!(await enabledCheckbox.isVisible()) || !(await scoreInput.isVisible())) continue;

		const enabled = (await enabledCheckbox.getAttribute('aria-checked')) === 'true';
		if (!enabled) continue;

		return { formatName: text, scoreInput };
	}

	throw new Error('No enabled scoring row found');
}

/** Find a scoring cell by format name and return its score input. */
async function findScoringCellByFormat(
	page: Page,
	formatName: string
): Promise<{ scoreInput: Locator }> {
	const exact = new RegExp(`^${escapeRegex(formatName)}$`);
	const row = page
		.locator('table tbody tr')
		.filter({ has: page.locator('td').first().filter({ hasText: exact }) })
		.first();
	await expect(row).toBeVisible({ timeout: 15_000 });
	const scoreCell = row.locator('td').nth(1);
	return {
		scoreInput: scoreCell.locator('input[type="number"]').first()
	};
}

test.describe('2.35 QP CF score same row conflict', () => {
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

	test('a) override — local CF score wins', async ({ page }) => {
		// Find first enabled scoring row
		await goToQualityProfileScoring(page, localId, profileName);
		const { formatName, scoreInput } = await findFirstEnabledScoringRow(page);
		const original = Number(await scoreInput.inputValue());
		const localValue = original + 10;
		const devValue = original + 20;

		// Local: change score
		await scoreInput.fill(String(localValue));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: change same CF score to a different value
		await goToQualityProfileScoring(page, devId, profileName);
		const dev = await findScoringCellByFormat(page, formatName);
		await dev.scoreInput.fill(String(devValue));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.35 qp scoring cf score same row conflict');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: local score wins
		await goToQualityProfileScoring(page, localId, profileName);
		const final = await findScoringCellByFormat(page, formatName);
		expect(Number(await final.scoreInput.inputValue())).toBe(localValue);
	});

	test('b) align — upstream CF score wins', async ({ page }) => {
		// Find first enabled scoring row
		await goToQualityProfileScoring(page, localId, profileName);
		const { formatName, scoreInput } = await findFirstEnabledScoringRow(page);
		const original = Number(await scoreInput.inputValue());
		const localValue = original + 10;
		const devValue = original + 20;

		// Local: change score
		await scoreInput.fill(String(localValue));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: change same CF score to a different value
		await goToQualityProfileScoring(page, devId, profileName);
		const dev = await findScoringCellByFormat(page, formatName);
		await dev.scoreInput.fill(String(devValue));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.35 qp scoring cf score same row conflict');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream score wins
		await goToQualityProfileScoring(page, localId, profileName);
		const final = await findScoringCellByFormat(page, formatName);
		expect(Number(await final.scoreInput.inputValue())).toBe(devValue);
	});
});
