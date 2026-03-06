/**
 * 2.38 Quality Profile — local delete CF score vs upstream update same row
 *
 * Setup: Local disables an enabled CF score row (DELETE op).
 *        Upstream changes the score value of that same row (UPDATE op).
 *        Both target the same (custom_format_name, arr_type) row.
 * Conflict: guard_mismatch — the DELETE's value guard doesn't match because
 *           upstream changed the score.
 *
 * a) Override → row stays deleted (local's intent wins)
 * b) Align → row keeps upstream's updated score
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
	enabledCheckbox: Locator;
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

		return { formatName: text, enabledCheckbox, scoreInput };
	}

	throw new Error('No enabled scoring row found');
}

/** Find a scoring cell by format name, scrolling through the virtual list if needed. */
async function findScoringCellByFormat(
	page: Page,
	formatName: string
): Promise<{ enabledCheckbox: Locator; scoreInput: Locator }> {
	const exact = new RegExp(`^${escapeRegex(formatName)}$`);
	const rowLocator = page
		.locator('table tbody tr')
		.filter({ has: page.locator('td').first().filter({ hasText: exact }) })
		.first();

	// Try without scrolling first
	if (await rowLocator.isVisible({ timeout: 3_000 }).catch(() => false)) {
		const scoreCell = rowLocator.locator('td').nth(1);
		return {
			enabledCheckbox: scoreCell.locator('[role="checkbox"]').first(),
			scoreInput: scoreCell.locator('input[type="number"]').first()
		};
	}

	// Scroll through the virtual list to find it
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(150);

	for (let attempt = 0; attempt < 60; attempt++) {
		if (await rowLocator.isVisible()) {
			await rowLocator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
			await page.waitForTimeout(300);

			const scoreCell = rowLocator.locator('td').nth(1);
			return {
				enabledCheckbox: scoreCell.locator('[role="checkbox"]').first(),
				scoreInput: scoreCell.locator('input[type="number"]').first()
			};
		}

		await page.evaluate(() => window.scrollBy(0, 500));
		await page.waitForTimeout(150);
	}

	throw new Error(`Could not find scoring cell for "${formatName}"`);
}

test.describe('2.38 QP local delete CF score vs upstream update same row', () => {
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

	test('a) override — row stays deleted', async ({ page }) => {
		// Find first enabled scoring row
		await goToQualityProfileScoring(page, localId, profileName);
		const { formatName, enabledCheckbox } = await findFirstEnabledScoringRow(page);

		// Local: disable the row (delete)
		await enabledCheckbox.click();
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: change the score on the same row
		await goToQualityProfileScoring(page, devId, profileName);
		const dev = await findScoringCellByFormat(page, formatName);
		const original = Number(await dev.scoreInput.inputValue());
		const devValue = original + 20;
		await dev.scoreInput.fill(String(devValue));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.38 qp scoring delete cf score vs upstream update');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: row stays deleted (disabled)
		await goToQualityProfileScoring(page, localId, profileName);
		const final = await findScoringCellByFormat(page, formatName);
		expect((await final.enabledCheckbox.getAttribute('aria-checked')) === 'true').toBe(false);
	});

	test('b) align — upstream score remains', async ({ page }) => {
		// Find first enabled scoring row
		await goToQualityProfileScoring(page, localId, profileName);
		const { formatName, enabledCheckbox } = await findFirstEnabledScoringRow(page);

		// Local: disable the row (delete)
		await enabledCheckbox.click();
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: change the score on the same row
		await goToQualityProfileScoring(page, devId, profileName);
		const dev = await findScoringCellByFormat(page, formatName);
		const original = Number(await dev.scoreInput.inputValue());
		const devValue = original + 20;
		await dev.scoreInput.fill(String(devValue));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.38 qp scoring delete cf score vs upstream update');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream score remains
		await goToQualityProfileScoring(page, localId, profileName);
		const final = await findScoringCellByFormat(page, formatName);
		expect((await final.enabledCheckbox.getAttribute('aria-checked')) === 'true').toBe(true);
		expect(Number(await final.scoreInput.inputValue())).toBe(devValue);
	});
});
