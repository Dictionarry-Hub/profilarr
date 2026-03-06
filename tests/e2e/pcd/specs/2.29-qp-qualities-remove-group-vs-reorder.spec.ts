/**
 * 2.29 Quality Profile — local remove (collapse) group vs upstream reorder
 *
 * Setup: DEV creates a group from the first two qualities and pushes.
 *        LOCAL pulls so both have the group. LOCAL collapses the group
 *        (ungroups back to individual qualities). DEV then reorders the
 *        quality list and pushes again.
 * Conflict: guard_mismatch — both sides changed quality rows.
 *
 * a) Override → local list without group (user collapsed group wins)
 * b) Align → upstream list with group + upstream reorder
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
const GROUP_NAME = 'E2E Test Group';

/** Read the ordered quality/group names from the qualities page. */
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

/**
 * Create a quality group via the modal by selecting the first two individual
 * qualities in the list. Returns the member names.
 */
async function createGroupFromFirstTwo(page: import('@playwright/test').Page): Promise<string[]> {
	await page.getByRole('button', { name: 'Create Group' }).click();

	const modal = page.getByRole('dialog');
	await modal.waitFor({ state: 'visible' });

	await modal.getByRole('textbox', { name: 'Group Name' }).fill(GROUP_NAME);

	const qualityButtons = modal.locator('button').filter({
		has: page.locator('[role="checkbox"]')
	});
	const first = (await qualityButtons.nth(0).innerText()).trim();
	const second = (await qualityButtons.nth(1).innerText()).trim();

	await qualityButtons.nth(0).click();
	await qualityButtons.nth(1).click();

	await modal.getByRole('button', { name: 'Create Group' }).click();
	await modal.waitFor({ state: 'hidden' });

	return [first, second];
}

/** Collapse (ungroup) a quality group by clicking the desktop X button on its row. */
async function collapseGroup(
	page: import('@playwright/test').Page,
	groupName: string
): Promise<void> {
	const rows = page.locator('div.space-y-4 > div[role="button"]');
	const groupRow = rows.filter({ hasText: groupName }).first();
	// Two collapse buttons exist (mobile + desktop); target the desktop one
	const desktopCollapse = groupRow.locator(
		'span.hidden.md\\:inline-flex button[title="Collapse group into individual qualities"]'
	);
	await desktopCollapse.click();
	await page.waitForTimeout(300);
}

test.describe('2.29 QP local remove quality group vs upstream reorder', () => {
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

	test('a) override — local list without group', async ({ page }) => {
		// 1. DEV creates a group and pushes (establishes base with group)
		await goToQualityProfileQualities(page, devId, profileName);
		const originalOrder = await getQualityOrder(page);
		expect(originalOrder.length).toBeGreaterThanOrEqual(3);

		const [member1, member2] = await createGroupFromFirstTwo(page);
		const orderWithGroup = await getQualityOrder(page);
		expect(orderWithGroup).toContain(GROUP_NAME);

		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		await exportAndPush(page, devId, 'e2e: 2.29 create group base');

		// 2. Pull into LOCAL so both have the group
		await pullChanges(page, localId);

		// 3. LOCAL collapses the group (ungroups)
		await goToQualityProfileQualities(page, localId, profileName);
		const localBeforeCollapse = await getQualityOrder(page);
		expect(localBeforeCollapse).toContain(GROUP_NAME);

		await collapseGroup(page, GROUP_NAME);

		const localAfterCollapse = await getQualityOrder(page);
		expect(localAfterCollapse).not.toContain(GROUP_NAME);
		// Should have individual qualities back (one more item than grouped list)
		expect(localAfterCollapse.length).toBe(localBeforeCollapse.length + 1);

		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// 4. DEV reorders the list (move first item down two positions)
		await goToQualitiesMobile(page, devId, profileName);
		await moveQualityDown(page, 0);
		await moveQualityDown(page, 1);
		const devOrder = await getQualityOrder(page);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await restoreDesktop(page);

		await exportAndPush(page, devId, 'e2e: 2.29 qp qualities remove group vs reorder');

		// 5. Pull into LOCAL → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: local list wins — no group, individual qualities
		await goToQualityProfileQualities(page, localId, profileName);
		const finalOrder = await getQualityOrder(page);

		expect(finalOrder).not.toContain(GROUP_NAME);
		// Individual members should be present
		expect(finalOrder).toContain(member1);
		expect(finalOrder).toContain(member2);
		// Length should match local collapsed state
		expect(finalOrder.length).toBe(localAfterCollapse.length);
	});

	test('b) align — upstream list with group', async ({ page }) => {
		// 1. DEV creates a group and pushes (establishes base with group)
		await goToQualityProfileQualities(page, devId, profileName);
		const originalOrder = await getQualityOrder(page);
		expect(originalOrder.length).toBeGreaterThanOrEqual(3);

		await createGroupFromFirstTwo(page);

		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		await exportAndPush(page, devId, 'e2e: 2.29 create group base');

		// 2. Pull into LOCAL so both have the group
		await pullChanges(page, localId);

		// 3. LOCAL collapses the group (ungroups)
		await goToQualityProfileQualities(page, localId, profileName);
		expect(await getQualityOrder(page)).toContain(GROUP_NAME);

		await collapseGroup(page, GROUP_NAME);
		expect(await getQualityOrder(page)).not.toContain(GROUP_NAME);

		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// 4. DEV reorders the list (move first item down two positions)
		await goToQualitiesMobile(page, devId, profileName);
		await moveQualityDown(page, 0);
		await moveQualityDown(page, 1);
		const devOrder = await getQualityOrder(page);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await restoreDesktop(page);

		await exportAndPush(page, devId, 'e2e: 2.29 qp qualities remove group vs reorder');

		// 5. Pull into LOCAL → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream wins — group still present, dev order
		await goToQualityProfileQualities(page, localId, profileName);
		const finalOrder = await getQualityOrder(page);

		// Group should be present (upstream kept it)
		expect(finalOrder).toContain(GROUP_NAME);
		// First three items should match dev order
		expect(finalOrder[0]).toBe(devOrder[0]);
		expect(finalOrder[1]).toBe(devOrder[1]);
		expect(finalOrder[2]).toBe(devOrder[2]);
	});
});
