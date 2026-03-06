/**
 * 2.44 Quality Profile — scoring dependsOn CF renamed upstream
 *
 * Setup: Local changes a CF's score in a QP (score → original+10).
 *        Upstream renames that same CF.
 * Conflict: guard_mismatch — local scoring op references old CF name
 *           which no longer exists in the scoring table after rename.
 *
 * a) Override → rename chain resolves old CF name to new name,
 *              local score is preserved on the renamed CF.
 * b) Align → upstream rename preserved, original score
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
	expectNoConflict,
	alignConflict
} from '../helpers/conflicts';
import {
	openFirstQualityProfileGeneral,
	goToQualityProfileScoring,
	goToCustomFormatGeneral,
	updateCfName
} from '../helpers/entity';
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

test.describe('2.44 QP scoring dependsOn CF renamed upstream', () => {
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

	test('a) override — local score preserved on renamed CF', async ({ page }) => {
		// Find first enabled scoring row on local
		await goToQualityProfileScoring(page, localId, profileName);
		const { formatName, scoreInput } = await findFirstEnabledScoringRow(page);
		const original = Number(await scoreInput.inputValue());
		const localValue = original + 10;
		const renamedCfName = `${formatName} E2E Renamed`;

		// Local: change score
		await scoreInput.fill(String(localValue));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: rename the CF
		await goToCustomFormatGeneral(page, devId, formatName);
		await updateCfName(page, renamedCfName);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.44 cf rename upstream');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override — rename chain resolves old CF name → new name,
		// so the local score is correctly applied to the renamed CF.
		const rows = page.locator('table tbody tr', { hasText: profileName });
		const overrideResponsePromise = page.waitForResponse((r) => {
			if (r.request().method() !== 'POST') return false;
			const url = r.url();
			return url.includes('/conflicts?/override') || url.includes('/conflicts?%2Foverride');
		});
		await rows.first().getByRole('button', { name: 'Override' }).click();
		await overrideResponsePromise;
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);

		// Verify: conflict resolved
		await goToConflicts(page, localId);
		await expectNoConflict(page, profileName);

		// Verify: renamed CF has LOCAL score (override preserved it)
		await goToQualityProfileScoring(page, localId, profileName);
		const final = await findScoringCellByFormat(page, renamedCfName);
		expect(Number(await final.scoreInput.inputValue())).toBe(localValue);
	});

	test('b) align — upstream rename with original score', async ({ page }) => {
		// Find first enabled scoring row on local
		await goToQualityProfileScoring(page, localId, profileName);
		const { formatName, scoreInput } = await findFirstEnabledScoringRow(page);
		const original = Number(await scoreInput.inputValue());
		const localValue = original + 10;
		const renamedCfName = `${formatName} E2E Renamed`;

		// Local: change score
		await scoreInput.fill(String(localValue));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: rename the CF
		await goToCustomFormatGeneral(page, devId, formatName);
		await updateCfName(page, renamedCfName);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.44 cf rename upstream');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream rename preserved, original score
		await goToQualityProfileScoring(page, localId, profileName);
		const final = await findScoringCellByFormat(page, renamedCfName);
		expect(Number(await final.scoreInput.inputValue())).toBe(original);
	});
});
