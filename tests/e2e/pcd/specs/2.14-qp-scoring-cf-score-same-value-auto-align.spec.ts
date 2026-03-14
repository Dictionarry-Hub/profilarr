/**
 * 2.14 Quality Profile — scoring CF row desired already matches upstream
 *
 * Setup: Local changes one CF score cell on scoring page.
 * Upstream changes the same CF score cell to the same desired value.
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

async function findFirstScoringRow(page: Page): Promise<{
	formatName: string;
	scoreCell: Locator;
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

		// First arr type column (radarr in current UI ordering)
		const scoreCell = row.locator('td').nth(1);
		const enabledCheckbox = scoreCell.locator('[role="checkbox"]').first();
		const scoreInput = scoreCell.locator('input[type="number"]').first();
		if (!(await enabledCheckbox.isVisible()) || !(await scoreInput.isVisible())) continue;

		return { formatName: text, scoreCell, enabledCheckbox, scoreInput };
	}

	throw new Error('No scoring row with editable score cell found');
}

async function findScoringCellByFormat(
	page: Page,
	formatName: string
): Promise<{ enabledCheckbox: Locator; scoreInput: Locator }> {
	const exact = new RegExp(`^${escapeRegex(formatName)}$`);
	const row = page
		.locator('table tbody tr')
		.filter({ has: page.locator('td').first().filter({ hasText: exact }) })
		.first();
	await expect(row).toBeVisible({ timeout: 15_000 });
	const scoreCell = row.locator('td').nth(1);
	return {
		enabledCheckbox: scoreCell.locator('[role="checkbox"]').first(),
		scoreInput: scoreCell.locator('input[type="number"]').first()
	};
}

test.describe('2.14 QP scoring CF row desired already matches upstream', () => {
	test.describe.configure({ timeout: 120_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let profileName: string;
	let targetFormatName: string;
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
		// Local: change one CF score cell (radarr column)
		await goToQualityProfileScoring(page, localId, profileName);
		const local = await findFirstScoringRow(page);
		targetFormatName = local.formatName;

		const enabledLocal = (await local.enabledCheckbox.getAttribute('aria-checked')) === 'true';
		const localCurrentScore = Number(await local.scoreInput.inputValue());
		desiredScore = enabledLocal ? localCurrentScore + 11 : 11;

		if (!enabledLocal) {
			await local.enabledCheckbox.click();
		}
		await local.scoreInput.fill(String(desiredScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: set same CF score cell to the same desired value
		await goToQualityProfileScoring(page, devId, profileName);
		const dev = await findScoringCellByFormat(page, targetFormatName);
		const enabledDev = (await dev.enabledCheckbox.getAttribute('aria-checked')) === 'true';
		if (!enabledDev) {
			await dev.enabledCheckbox.click();
		}
		await dev.scoreInput.fill(String(desiredScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream then pull local
		await exportAndPush(
			page,
			devId,
			'e2e: 2.14 qp scoring cf row desired matches upstream auto-align'
		);
		await pullChanges(page, localId);

		// Auto-align: no conflict remains
		await goToConflicts(page, localId);
		const conflictCount = await getConflictCount(page);
		expect(conflictCount).toBe(0);

		// Local op should be dropped
		await page.goto(`/databases/${localId}/changes`);
		await page.waitForLoadState('networkidle');
		await expect
			.poll(
				async () =>
					(await page.getByText('No changes to pull or publish right now.').isVisible()) ||
					(await page.getByText('No unpublished changes').isVisible()),
				{ timeout: 15_000 }
			)
			.toBe(true);

		// Final value is the shared desired score
		await goToQualityProfileScoring(page, localId, profileName);
		const final = await findScoringCellByFormat(page, targetFormatName);
		expect((await final.enabledCheckbox.getAttribute('aria-checked')) === 'true').toBe(true);
		expect(Number(await final.scoreInput.inputValue())).toBe(desiredScore);
	});
});
