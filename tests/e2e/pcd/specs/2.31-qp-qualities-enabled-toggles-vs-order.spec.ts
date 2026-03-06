/**
 * 2.31 Quality Profile — local enabled toggles vs upstream order changes
 *
 * Setup: Local toggles the enabled state on a non-upgrade-until quality.
 *        Upstream reorders the quality list (moves first item down).
 *        Both modify quality_profile_qualities rows.
 * Conflict: guard_mismatch — both sides changed quality rows.
 *
 * a) Override → local enabled states + local list
 * b) Align → upstream list + upstream enabled states
 *
 * Uses mobile viewport (< 768px) for move buttons on upstream reorder.
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
const MOBILE_VIEWPORT = { width: 600, height: 800 };
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

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
 * Read the enabled state of each quality row.
 * Each row has two role="checkbox" buttons: first is upgrade-until, second is enabled.
 */
async function getEnabledStates(page: import('@playwright/test').Page): Promise<boolean[]> {
	const rows = page.locator('div.space-y-4 > div[role="button"]');
	const count = await rows.count();
	const states: boolean[] = [];
	for (let i = 0; i < count; i++) {
		const enabledCheckbox = rows.nth(i).locator('[role="checkbox"]').nth(1);
		const checked = await enabledCheckbox.getAttribute('aria-checked');
		states.push(checked === 'true');
	}
	return states;
}

/**
 * Click the enabled checkbox on the quality at the given index.
 * The second role="checkbox" in each row is the enabled toggle.
 */
async function clickEnabled(page: import('@playwright/test').Page, index: number): Promise<void> {
	const row = page.locator('div.space-y-4 > div[role="button"]').nth(index);
	await row.locator('[role="checkbox"]').nth(1).click();
	await page.waitForTimeout(200);
}

/**
 * Find the index of the quality that has the upgrade-until marker.
 * Returns -1 if none found.
 */
async function findUpgradeUntilIndex(page: import('@playwright/test').Page): Promise<number> {
	const rows = page.locator('div.space-y-4 > div[role="button"]');
	const count = await rows.count();
	for (let i = 0; i < count; i++) {
		const upgradeCheckbox = rows.nth(i).locator('[role="checkbox"]').first();
		const checked = await upgradeCheckbox.getAttribute('aria-checked');
		if (checked === 'true') return i;
	}
	return -1;
}

/** Click the move-down button on a quality row (mobile view). */
async function moveQualityDown(
	page: import('@playwright/test').Page,
	index: number
): Promise<void> {
	const row = page.locator('div.space-y-4 > div[role="button"]').nth(index);
	const mobileButtons = row.locator('.md\\:hidden button');
	await mobileButtons.last().click();
	await page.waitForTimeout(200);
}

/** Navigate to qualities page in mobile viewport for move buttons. */
async function goToQualitiesMobile(
	page: import('@playwright/test').Page,
	databaseId: number,
	profileName: string
): Promise<void> {
	await goToQualityProfileQualities(page, databaseId, profileName);
	await page.setViewportSize(MOBILE_VIEWPORT);
	await page.waitForTimeout(300);
}

/** Restore desktop viewport. */
async function restoreDesktop(page: import('@playwright/test').Page): Promise<void> {
	await page.setViewportSize(DESKTOP_VIEWPORT);
}

test.describe('2.31 QP local enabled toggles vs upstream order changes', () => {
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

	test('a) override — local enabled states + local list', async ({ page }) => {
		// Read original state
		await goToQualityProfileQualities(page, localId, profileName);
		const originalOrder = await getQualityOrder(page);
		expect(originalOrder.length).toBeGreaterThanOrEqual(3);

		const originalEnabled = await getEnabledStates(page);

		// Find a quality that doesn't have upgrade-until (can't disable upgrade-until quality)
		const upgradeIdx = await findUpgradeUntilIndex(page);
		const toggleIdx = upgradeIdx === 0 ? 1 : 0;

		// Local: toggle enabled on a non-upgrade-until quality
		await clickEnabled(page, toggleIdx);
		const localEnabled = await getEnabledStates(page);
		expect(localEnabled[toggleIdx]).toBe(!originalEnabled[toggleIdx]);

		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: reorder — move first item down two positions
		await goToQualitiesMobile(page, devId, profileName);
		await moveQualityDown(page, 0);
		await moveQualityDown(page, 1);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await restoreDesktop(page);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.31 qp enabled toggles vs order');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: local enabled states + local list wins
		await goToQualityProfileQualities(page, localId, profileName);
		const finalOrder = await getQualityOrder(page);
		const finalEnabled = await getEnabledStates(page);

		// Order should match original (local didn't reorder)
		expect(finalOrder[0]).toBe(originalOrder[0]);
		expect(finalOrder[1]).toBe(originalOrder[1]);

		// Toggled quality should have local's toggled enabled state
		expect(finalEnabled[toggleIdx]).toBe(localEnabled[toggleIdx]);
	});

	test('b) align — upstream list + upstream enabled states', async ({ page }) => {
		// Read original state
		await goToQualityProfileQualities(page, localId, profileName);
		const originalOrder = await getQualityOrder(page);
		expect(originalOrder.length).toBeGreaterThanOrEqual(3);

		// Find a quality that doesn't have upgrade-until (can't disable upgrade-until quality)
		const upgradeIdx = await findUpgradeUntilIndex(page);
		const toggleIdx = upgradeIdx === 0 ? 1 : 0;

		// Local: toggle enabled on a non-upgrade-until quality
		await clickEnabled(page, toggleIdx);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: reorder — move first item down two positions
		await goToQualitiesMobile(page, devId, profileName);
		await moveQualityDown(page, 0);
		await moveQualityDown(page, 1);
		const devOrder = await getQualityOrder(page);
		const devEnabled = await getEnabledStates(page);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await restoreDesktop(page);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.31 qp enabled toggles vs order');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream list + upstream enabled states wins
		await goToQualityProfileQualities(page, localId, profileName);
		const finalOrder = await getQualityOrder(page);
		const finalEnabled = await getEnabledStates(page);

		// Order should match dev (upstream reorder)
		expect(finalOrder[0]).toBe(devOrder[0]);
		expect(finalOrder[1]).toBe(devOrder[1]);
		expect(finalOrder[2]).toBe(devOrder[2]);

		// Enabled states should match dev (no local toggle)
		expect(finalEnabled[0]).toBe(devEnabled[0]);
		expect(finalEnabled[1]).toBe(devEnabled[1]);
		expect(finalEnabled[2]).toBe(devEnabled[2]);
	});
});
