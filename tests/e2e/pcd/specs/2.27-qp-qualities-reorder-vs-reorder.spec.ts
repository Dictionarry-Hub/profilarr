/**
 * 2.27 Quality Profile — qualities reorder vs reorder conflict
 *
 * Setup: Local moves the first quality row down one position. Upstream
 *        moves the first row down two positions. Both change the same
 *        rows' positions.
 * Conflict: guard_mismatch — both sides changed position of the same rows.
 *
 * a) Override → local order (user's desired row positions applied)
 * b) Align → upstream order (local ops dropped)
 *
 * Temporarily sets mobile viewport (< 768px) to access up/down move
 * buttons on the qualities page only.
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

/** Click the move-down button on a quality row (mobile view). */
async function moveQualityDown(
	page: import('@playwright/test').Page,
	index: number
): Promise<void> {
	const row = page.locator('div.space-y-4 > div[role="button"]').nth(index);
	// ChevronDown is the last button inside the md:hidden mobile-only container
	const mobileButtons = row.locator('.md\\:hidden button');
	await mobileButtons.last().click();
	await page.waitForTimeout(200); // Let Svelte re-render
}

/** Navigate to qualities page in mobile viewport for move buttons. */
async function goToQualitiesMobile(
	page: import('@playwright/test').Page,
	databaseId: number,
	profileName: string
): Promise<void> {
	await goToQualityProfileQualities(page, databaseId, profileName);
	await page.setViewportSize(MOBILE_VIEWPORT);
	await page.waitForTimeout(300); // Let media query fire
}

/** Restore desktop viewport. */
async function restoreDesktop(page: import('@playwright/test').Page): Promise<void> {
	await page.setViewportSize(DESKTOP_VIEWPORT);
}

test.describe('2.27 QP qualities reorder vs reorder conflict', () => {
	test.describe.configure({ timeout: 120_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let profileName: string;
	let originalOrder: string[];

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

	test('a) override — local order', async ({ page }) => {
		// Read original order (mobile for move buttons)
		await goToQualitiesMobile(page, localId, profileName);
		originalOrder = await getQualityOrder(page);
		expect(originalOrder.length).toBeGreaterThanOrEqual(3);

		// Local: move first item down one position
		await moveQualityDown(page, 0);
		const localOrder = await getQualityOrder(page);
		expect(localOrder[0]).toBe(originalOrder[1]);
		expect(localOrder[1]).toBe(originalOrder[0]);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await restoreDesktop(page);

		// Dev: move first item down two positions
		await goToQualitiesMobile(page, devId, profileName);
		await moveQualityDown(page, 0);
		await moveQualityDown(page, 1);
		const devOrder = await getQualityOrder(page);
		expect(devOrder[0]).toBe(originalOrder[1]);
		expect(devOrder[2]).toBe(originalOrder[0]);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await restoreDesktop(page);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.27 qp qualities reorder vs reorder');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: local order wins
		await goToQualityProfileQualities(page, localId, profileName);
		const finalOrder = await getQualityOrder(page);
		expect(finalOrder[0]).toBe(localOrder[0]);
		expect(finalOrder[1]).toBe(localOrder[1]);
	});

	test('b) align — upstream order', async ({ page }) => {
		// Read original order (mobile for move buttons)
		await goToQualitiesMobile(page, localId, profileName);
		originalOrder = await getQualityOrder(page);
		expect(originalOrder.length).toBeGreaterThanOrEqual(3);

		// Local: move first item down one position
		await moveQualityDown(page, 0);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await restoreDesktop(page);

		// Dev: move first item down two positions
		await goToQualitiesMobile(page, devId, profileName);
		await moveQualityDown(page, 0);
		await moveQualityDown(page, 1);
		const devOrder = await getQualityOrder(page);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await restoreDesktop(page);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.27 qp qualities reorder vs reorder');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream order wins (local ops dropped)
		await goToQualityProfileQualities(page, localId, profileName);
		const finalOrder = await getQualityOrder(page);
		expect(finalOrder[0]).toBe(devOrder[0]);
		expect(finalOrder[1]).toBe(devOrder[1]);
		expect(finalOrder[2]).toBe(devOrder[2]);
	});
});
