/**
 * 2.30 Quality Profile — local upgrade-until toggle vs upstream toggle
 *
 * Setup: Local moves the upgrade-until marker from the original quality to
 *        a different one. Upstream moves it to yet another quality.
 *        Both change the same upgrade_until column on quality rows.
 * Conflict: guard_mismatch — both sides changed upgrade_until flags.
 *
 * a) Override → local upgrade-until target wins
 * b) Align → upstream upgrade-until target wins
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
import { openFirstQualityProfileGeneral, goToQualityProfileQualities } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';

/** Read the ordered quality names from the qualities page. */
async function getQualityOrder(page: import('@playwright/test').Page): Promise<string[]> {
	const rows = page.locator('div.space-y-4 > div[role="button"]');
	const count = await rows.count();
	const names: string[] = [];
	for (let i = 0; i < count; i++) {
		const name = (await rows.nth(i).locator('div.font-medium').first().innerText()).trim();
		names.push(name);
	}
	return names;
}

/**
 * Find which quality name currently has the upgrade-until marker.
 * Each row has two role="checkbox" buttons: first is upgrade-until, second is enabled.
 */
async function getUpgradeUntilName(page: import('@playwright/test').Page): Promise<string | null> {
	const rows = page.locator('div.space-y-4 > div[role="button"]');
	const count = await rows.count();
	for (let i = 0; i < count; i++) {
		const row = rows.nth(i);
		const upgradeCheckbox = row.locator('[role="checkbox"]').first();
		const checked = await upgradeCheckbox.getAttribute('aria-checked');
		if (checked === 'true') {
			return (await row.locator('div.font-medium').first().innerText()).trim();
		}
	}
	return null;
}

/**
 * Click the upgrade-until checkbox on the quality at the given index.
 * The first role="checkbox" in each row is the upgrade-until toggle.
 */
async function clickUpgradeUntil(
	page: import('@playwright/test').Page,
	index: number
): Promise<void> {
	const row = page.locator('div.space-y-4 > div[role="button"]').nth(index);
	await row.locator('[role="checkbox"]').first().click();
	await page.waitForTimeout(200);
}

test.describe('2.30 QP qualities upgrade-until toggle vs upstream toggle', () => {
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

	test('a) override — local upgrade-until target wins', async ({ page }) => {
		// Read original state
		await goToQualityProfileQualities(page, localId, profileName);
		const names = await getQualityOrder(page);
		expect(names.length).toBeGreaterThanOrEqual(3);

		const originalTarget = await getUpgradeUntilName(page);
		expect(originalTarget).toBeTruthy();

		// Find two indices different from the original upgrade-until target
		const originalIdx = names.indexOf(originalTarget!);
		const localIdx = originalIdx === 0 ? 1 : 0;
		const devIdx = originalIdx <= 1 ? 2 : 1;

		// Local: move upgrade-until to localIdx
		await clickUpgradeUntil(page, localIdx);
		const localTarget = names[localIdx];
		expect(await getUpgradeUntilName(page)).toBe(localTarget);

		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: move upgrade-until to devIdx
		await goToQualityProfileQualities(page, devId, profileName);
		await clickUpgradeUntil(page, devIdx);
		const devTarget = names[devIdx];
		expect(await getUpgradeUntilName(page)).toBe(devTarget);

		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.30 qp upgrade-until toggle conflict');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: local upgrade-until target wins
		await goToQualityProfileQualities(page, localId, profileName);
		expect(await getUpgradeUntilName(page)).toBe(localTarget);
	});

	test('b) align — upstream upgrade-until target wins', async ({ page }) => {
		// Read original state
		await goToQualityProfileQualities(page, localId, profileName);
		const names = await getQualityOrder(page);
		expect(names.length).toBeGreaterThanOrEqual(3);

		const originalTarget = await getUpgradeUntilName(page);
		expect(originalTarget).toBeTruthy();

		const originalIdx = names.indexOf(originalTarget!);
		const localIdx = originalIdx === 0 ? 1 : 0;
		const devIdx = originalIdx <= 1 ? 2 : 1;

		// Local: move upgrade-until to localIdx
		await clickUpgradeUntil(page, localIdx);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: move upgrade-until to devIdx
		await goToQualityProfileQualities(page, devId, profileName);
		await clickUpgradeUntil(page, devIdx);
		const devTarget = names[devIdx];

		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.30 qp upgrade-until toggle conflict');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream upgrade-until target wins
		await goToQualityProfileQualities(page, localId, profileName);
		expect(await getUpgradeUntilName(page)).toBe(devTarget);
	});
});
