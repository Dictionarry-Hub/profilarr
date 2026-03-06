/**
 * 2.37 Quality Profile — local add CF score vs upstream add same row
 *
 * Setup: Both local and upstream enable the same previously-disabled CF score
 *        cell and set different score values.
 *        Both generate INSERT ops for the same (custom_format_name, arr_type).
 * Conflict: duplicate_key — the row already exists when local's INSERT runs.
 *
 * a) Override → local score value wins
 * b) Align → upstream score value wins
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

/**
 * Find the first disabled scoring cell in column 1.
 * The table is virtualized, so we must scroll to reveal all rows.
 */
async function findFirstDisabledScoringRow(page: Page): Promise<string> {
	const container = page.locator('div.overflow-x-auto').first();
	await expect(container).toBeVisible({ timeout: 15_000 });

	const seen = new Set<string>();

	for (let attempt = 0; attempt < 50; attempt++) {
		const rows = page.locator('table tbody tr');
		const count = await rows.count();

		for (let i = 0; i < count; i++) {
			const row = rows.nth(i);
			const nameCell = row.locator('td').first();
			const text = (await nameCell.innerText()).trim();
			if (!text || seen.has(text)) continue;
			seen.add(text);

			const scoreCell = row.locator('td').nth(1);
			const enabledCheckbox = scoreCell.locator('[role="checkbox"]').first();
			if (!(await enabledCheckbox.isVisible())) continue;

			const enabled = (await enabledCheckbox.getAttribute('aria-checked')) === 'true';
			if (!enabled) return text;
		}

		// Scroll window down — virtual list listens to window scroll, not container
		await page.evaluate(() => window.scrollBy(0, 500));
		await page.waitForTimeout(150);
	}

	throw new Error('No disabled scoring row found after scrolling');
}

/**
 * Scroll the virtualized table until a row with the given format name is visible,
 * then center it in the viewport and return its column 1 locators.
 */
async function scrollToScoringCell(
	page: Page,
	formatName: string
): Promise<{ enabledCheckbox: Locator; scoreInput: Locator }> {
	// Reset scroll to top first — virtual list listens to window scroll
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(150);

	const exact = new RegExp(`^${escapeRegex(formatName)}$`);
	const rowLocator = page
		.locator('table tbody tr')
		.filter({ has: page.locator('td').first().filter({ hasText: exact }) })
		.first();

	for (let attempt = 0; attempt < 60; attempt++) {
		if (await rowLocator.isVisible()) {
			// Center the row in the viewport so the virtual list keeps it rendered
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

	throw new Error(`Could not scroll to scoring cell for "${formatName}"`);
}

test.describe('2.37 QP local add CF score vs upstream add same row', () => {
	test.describe.configure({ timeout: 180_000 });

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

	test('a) override — local score wins', async ({ page }) => {
		// Find first disabled scoring row (scrolls through virtual list)
		await goToQualityProfileScoring(page, localId, profileName);
		const formatName = await findFirstDisabledScoringRow(page);

		const localScore = 50;

		// Scroll to the row and enable it
		const local = await scrollToScoringCell(page, formatName);
		await local.enabledCheckbox.click();
		await local.scoreInput.fill(String(localScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: enable same cell with different score
		const devScore = 100;
		await goToQualityProfileScoring(page, devId, profileName);
		const dev = await scrollToScoringCell(page, formatName);
		await dev.enabledCheckbox.click();
		await dev.scoreInput.fill(String(devScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.37 qp scoring add cf score vs upstream add');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: local score wins
		await goToQualityProfileScoring(page, localId, profileName);
		const final = await scrollToScoringCell(page, formatName);
		expect((await final.enabledCheckbox.getAttribute('aria-checked')) === 'true').toBe(true);
		expect(Number(await final.scoreInput.inputValue())).toBe(localScore);
	});

	test('b) align — upstream score wins', async ({ page }) => {
		// Find first disabled scoring row (scrolls through virtual list)
		await goToQualityProfileScoring(page, localId, profileName);
		const formatName = await findFirstDisabledScoringRow(page);

		const localScore = 50;

		// Scroll to the row and enable it
		const local = await scrollToScoringCell(page, formatName);
		await local.enabledCheckbox.click();
		await local.scoreInput.fill(String(localScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: enable same cell with different score
		const devScore = 100;
		await goToQualityProfileScoring(page, devId, profileName);
		const dev = await scrollToScoringCell(page, formatName);
		await dev.enabledCheckbox.click();
		await dev.scoreInput.fill(String(devScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.37 qp scoring add cf score vs upstream add');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream score wins
		await goToQualityProfileScoring(page, localId, profileName);
		const final = await scrollToScoringCell(page, formatName);
		expect((await final.enabledCheckbox.getAttribute('aria-checked')) === 'true').toBe(true);
		expect(Number(await final.scoreInput.inputValue())).toBe(devScore);
	});
});
