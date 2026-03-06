/**
 * 2.36 Quality Profile — CF score different arr_type (no conflict)
 *
 * Setup: Local changes one CF's score in the first arr_type column.
 *        Upstream changes a different CF's score in the second arr_type column.
 *        Each targets a different (custom_format_name, arr_type) row.
 * Expected: No conflict. Both scores apply on separate rows.
 *
 * Uses two different CFs to avoid auto-expansion conflicts: when a CF has
 * an 'all' type score, modifying it triggers expansion ops that would
 * conflict if both sides touch the same CF.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, getConflictCount } from '../helpers/conflicts';
import { openFirstQualityProfileGeneral, goToQualityProfileScoring } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Get the number of arr_type columns in the scoring table. */
async function getArrTypeColumnCount(page: Page): Promise<number> {
	const headerCells = page.locator('table thead th');
	return (await headerCells.count()) - 1;
}

/** Get the score cell locators for a specific column index (1-based, matching td.nth). */
function getScoreCellLocators(
	row: Locator,
	colIndex: number
): { enabledCheckbox: Locator; scoreInput: Locator } {
	const scoreCell = row.locator('td').nth(colIndex);
	return {
		enabledCheckbox: scoreCell.locator('[role="checkbox"]').first(),
		scoreInput: scoreCell.locator('input[type="number"]').first()
	};
}

/**
 * Find two different enabled scoring rows — one with column 1 enabled,
 * one with column 2 enabled. Returns their format names.
 */
async function findTwoEnabledRows(page: Page): Promise<{ format1: string; format2: string }> {
	const rows = page.locator('table tbody tr');
	await expect(rows.first()).toBeVisible({ timeout: 15_000 });

	let format1: string | null = null;
	let format2: string | null = null;

	const count = await rows.count();
	for (let i = 0; i < count; i++) {
		const row = rows.nth(i);
		const nameCell = row.locator('td').first();
		const text = (await nameCell.innerText()).trim();
		if (!text) continue;

		if (!format1) {
			const col1 = getScoreCellLocators(row, 1);
			if (!(await col1.enabledCheckbox.isVisible())) continue;
			const enabled = (await col1.enabledCheckbox.getAttribute('aria-checked')) === 'true';
			if (enabled) {
				format1 = text;
				continue;
			}
		}

		if (!format2) {
			const col2 = getScoreCellLocators(row, 2);
			if (!(await col2.enabledCheckbox.isVisible())) continue;
			const enabled = (await col2.enabledCheckbox.getAttribute('aria-checked')) === 'true';
			if (enabled) {
				format2 = text;
			}
		}

		if (format1 && format2) break;
	}

	if (!format1 || !format2) {
		throw new Error('Could not find two scoring rows with enabled cells in different columns');
	}

	return { format1, format2 };
}

/** Find a scoring row by format name and return locators for a given column. */
async function findScoringCellByFormat(
	page: Page,
	formatName: string,
	colIndex: number
): Promise<{ enabledCheckbox: Locator; scoreInput: Locator }> {
	const exact = new RegExp(`^${escapeRegex(formatName)}$`);
	const row = page
		.locator('table tbody tr')
		.filter({ has: page.locator('td').first().filter({ hasText: exact }) })
		.first();
	await expect(row).toBeVisible({ timeout: 15_000 });
	return getScoreCellLocators(row, colIndex);
}

test.describe('2.36 QP CF score different arr_type — no conflict', () => {
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

	test('no conflict — different CFs in different arr_type columns', async ({ page }) => {
		// Verify at least 2 arr_type columns exist
		await goToQualityProfileScoring(page, localId, profileName);
		const colCount = await getArrTypeColumnCount(page);
		expect(colCount).toBeGreaterThanOrEqual(2);

		// Find two different CFs — one enabled in col 1, one in col 2
		const { format1, format2 } = await findTwoEnabledRows(page);

		// Read original score for format1 col 1
		const localCell = await findScoringCellByFormat(page, format1, 1);
		const originalCol1 = Number(await localCell.scoreInput.inputValue());
		const localValue = originalCol1 + 10;

		// Local: change format1's score in column 1
		await localCell.scoreInput.fill(String(localValue));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: change format2's score in column 2
		await goToQualityProfileScoring(page, devId, profileName);
		const devCell = await findScoringCellByFormat(page, format2, 2);
		const originalCol2 = Number(await devCell.scoreInput.inputValue());
		const devValue = originalCol2 + 20;

		await devCell.scoreInput.fill(String(devValue));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.36 qp scoring cf score different arr type');

		// Pull into local — should be no conflict
		await pullChanges(page, localId);

		// Verify: no conflicts
		await goToConflicts(page, localId);
		expect(await getConflictCount(page)).toBe(0);

		// Verify: both scores applied
		await goToQualityProfileScoring(page, localId, profileName);
		const finalCol1 = await findScoringCellByFormat(page, format1, 1);
		const finalCol2 = await findScoringCellByFormat(page, format2, 2);

		expect(Number(await finalCol1.scoreInput.inputValue())).toBe(localValue);
		expect(Number(await finalCol2.scoreInput.inputValue())).toBe(devValue);
	});
});
