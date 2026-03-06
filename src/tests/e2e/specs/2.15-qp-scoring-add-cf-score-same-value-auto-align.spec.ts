/**
 * 2.15 Quality Profile — scoring add CF score row desired already matches upstream
 *
 * Setup: Local adds a CF score row (disabled score cell -> enabled with score).
 * Upstream adds the same CF score row with the same value.
 * Expected: Auto-align (no conflict). Local op is dropped.
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

async function findFirstDisabledScoringCell(page: Page): Promise<{
	formatName: string;
	scoreColumnIndex: number;
	enabledCheckbox: Locator;
	scoreInput: Locator;
}> {
	const rows = page.locator('table tbody tr');
	await expect(rows.first()).toBeVisible({ timeout: 15_000 });

	const rowCount = await rows.count();
	for (let i = 0; i < rowCount; i++) {
		const row = rows.nth(i);
		const formatName = (await row.locator('td').first().innerText()).trim();
		if (!formatName) continue;

		// Score columns start at td index 1 (after name column)
		const scoreColCount = (await row.locator('td').count()) - 1;
		for (let scoreOffset = 0; scoreOffset < scoreColCount; scoreOffset++) {
			const scoreColumnIndex = scoreOffset + 1;
			const scoreCell = row.locator('td').nth(scoreColumnIndex);
			const enabledCheckbox = scoreCell.locator('[role="checkbox"]').first();
			const scoreInput = scoreCell.locator('input[type="number"]').first();

			if (!(await enabledCheckbox.isVisible()) || !(await scoreInput.isVisible())) {
				continue;
			}

			const enabled = (await enabledCheckbox.getAttribute('aria-checked')) === 'true';
			if (!enabled) {
				return { formatName, scoreColumnIndex, enabledCheckbox, scoreInput };
			}
		}
	}

	throw new Error('No disabled scoring cell found for 2.15 add-row auto-align test');
}

async function findScoringCell(
	page: Page,
	formatName: string,
	scoreColumnIndex: number
): Promise<{ enabledCheckbox: Locator; scoreInput: Locator }> {
	const exact = new RegExp(`^${escapeRegex(formatName)}$`);
	const row = page
		.locator('table tbody tr')
		.filter({ has: page.locator('td').first().filter({ hasText: exact }) })
		.first();
	await expect(row).toBeVisible({ timeout: 15_000 });

	const scoreCell = row.locator('td').nth(scoreColumnIndex);
	return {
		enabledCheckbox: scoreCell.locator('[role="checkbox"]').first(),
		scoreInput: scoreCell.locator('input[type="number"]').first()
	};
}

test.describe('2.15 QP scoring add CF score row desired already matches upstream', () => {
	test.describe.configure({ timeout: 120_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let profileName: string;
	let targetFormatName: string;
	let targetScoreColumnIndex: number;
	let desiredScore: number;

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

	test('auto-align', async ({ page }) => {
		// Local: add a score row by enabling a disabled score cell and setting a value.
		await goToQualityProfileScoring(page, localId, profileName);
		const local = await findFirstDisabledScoringCell(page);
		targetFormatName = local.formatName;
		targetScoreColumnIndex = local.scoreColumnIndex;
		desiredScore = 17;

		await local.enabledCheckbox.click();
		await local.scoreInput.fill(String(desiredScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: add the same score row with the same value.
		await goToQualityProfileScoring(page, devId, profileName);
		const dev = await findScoringCell(page, targetFormatName, targetScoreColumnIndex);
		if ((await dev.enabledCheckbox.getAttribute('aria-checked')) !== 'true') {
			await dev.enabledCheckbox.click();
		}
		await dev.scoreInput.fill(String(desiredScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		await exportAndPush(
			page,
			devId,
			'e2e: 2.15 qp scoring add cf score row desired matches upstream auto-align'
		);
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		expect(await getConflictCount(page)).toBe(0);

		await page.goto(`/databases/${localId}/changes`);
		await page.waitForLoadState('networkidle');
		await expect(page.getByText('No unpublished changes')).toBeVisible({ timeout: 15_000 });

		await goToQualityProfileScoring(page, localId, profileName);
		const final = await findScoringCell(page, targetFormatName, targetScoreColumnIndex);
		expect((await final.enabledCheckbox.getAttribute('aria-checked')) === 'true').toBe(true);
		expect(Number(await final.scoreInput.inputValue())).toBe(desiredScore);
	});
});
