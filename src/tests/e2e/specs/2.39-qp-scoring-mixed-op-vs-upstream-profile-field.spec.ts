/**
 * 2.39 Quality Profile — mixed scoring op vs upstream profile-field change
 *
 * Setup: Local changes minimumScore AND a CF score value in one save.
 *        Upstream changes minimumScore to a different value.
 *        The profile-level op conflicts (guard_mismatch).
 *        The CF score op targets a separate row/table and applies cleanly.
 *
 * a) Override → local minimumScore wins; CF score has local's value
 * b) Align → upstream minimumScore wins; CF score still has local's value
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

/** Find the first enabled scoring row and return its format name + score input. */
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

/** Find a scoring cell by format name. */
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

test.describe('2.39 QP mixed scoring op vs upstream profile-field change', () => {
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

	test('a) override — local minimumScore + local CF score', async ({ page }) => {
		// Go to scoring page and read originals
		await goToQualityProfileScoring(page, localId, profileName);

		const minInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		await expect(minInput).toBeVisible({ timeout: 10_000 });
		const originalMin = Number(await minInput.inputValue());

		const { formatName, scoreInput } = await findFirstEnabledScoringRow(page);
		const originalCfScore = Number(await scoreInput.inputValue());

		const localMin = originalMin + 10;
		const localCfScore = originalCfScore + 10;

		// Local: change both minimumScore and CF score, then save
		await minInput.fill(String(localMin));
		await scoreInput.fill(String(localCfScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: change only minimumScore
		const devMin = originalMin + 20;
		await goToQualityProfileScoring(page, devId, profileName);
		const devMinInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		await expect(devMinInput).toBeVisible({ timeout: 10_000 });
		await devMinInput.fill(String(devMin));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.39 qp scoring mixed op vs upstream profile field');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: local minimumScore wins, local CF score applied
		await goToQualityProfileScoring(page, localId, profileName);
		const finalMin = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		expect(Number(await finalMin.inputValue())).toBe(localMin);

		const finalCf = await findScoringCellByFormat(page, formatName);
		expect(Number(await finalCf.scoreInput.inputValue())).toBe(localCfScore);
	});

	test('b) align — upstream minimumScore + local CF score survives', async ({ page }) => {
		// Go to scoring page and read originals
		await goToQualityProfileScoring(page, localId, profileName);

		const minInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		await expect(minInput).toBeVisible({ timeout: 10_000 });
		const originalMin = Number(await minInput.inputValue());

		const { formatName, scoreInput } = await findFirstEnabledScoringRow(page);
		const originalCfScore = Number(await scoreInput.inputValue());

		const localMin = originalMin + 10;
		const localCfScore = originalCfScore + 10;

		// Local: change both minimumScore and CF score, then save
		await minInput.fill(String(localMin));
		await scoreInput.fill(String(localCfScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: change only minimumScore
		const devMin = originalMin + 20;
		await goToQualityProfileScoring(page, devId, profileName);
		const devMinInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		await expect(devMinInput).toBeVisible({ timeout: 10_000 });
		await devMinInput.fill(String(devMin));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.39 qp scoring mixed op vs upstream profile field');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream minimumScore wins, local CF score survives
		await goToQualityProfileScoring(page, localId, profileName);
		const finalMin = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		expect(Number(await finalMin.inputValue())).toBe(devMin);

		const finalCf = await findScoringCellByFormat(page, formatName);
		expect(Number(await finalCf.scoreInput.inputValue())).toBe(localCfScore);
	});
});
