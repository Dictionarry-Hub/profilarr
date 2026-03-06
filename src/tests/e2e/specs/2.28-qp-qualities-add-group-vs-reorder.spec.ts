/**
 * 2.28 Quality Profile — local add group vs upstream reorder conflict
 *
 * Setup: Local creates a quality group (combining two individual qualities).
 *        Upstream reorders the quality list (moves first item down).
 *        Both modify the quality_profile_qualities table (full-replace).
 * Conflict: guard_mismatch — both sides changed quality rows.
 *
 * a) Override → local list with group (user's desired state applied)
 * b) Align → upstream list without group (local ops dropped)
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
	// Open "Create Group" modal via the page header button
	await page.getByRole('button', { name: 'Create Group' }).click();

	// Wait for the modal dialog to appear
	const modal = page.getByRole('dialog');
	await modal.waitFor({ state: 'visible' });

	// Fill group name
	await modal.getByRole('textbox', { name: 'Group Name' }).fill(GROUP_NAME);

	// Read the first two available quality names from the modal's quality list.
	// Each quality button contains a checkbox — use that to distinguish from
	// the Cancel/Create Group footer buttons.
	const qualityButtons = modal.locator('button').filter({
		has: page.locator('[role="checkbox"]')
	});
	const first = (await qualityButtons.nth(0).innerText()).trim();
	const second = (await qualityButtons.nth(1).innerText()).trim();

	// Select them
	await qualityButtons.nth(0).click();
	await qualityButtons.nth(1).click();

	// Confirm — the "Create Group" button inside the modal footer
	await modal.getByRole('button', { name: 'Create Group' }).click();

	// Wait for modal to close
	await modal.waitFor({ state: 'hidden' });

	return [first, second];
}

test.describe('2.28 QP qualities add group vs upstream reorder conflict', () => {
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

	test('a) override — local list with group', async ({ page }) => {
		// Navigate to qualities page
		await goToQualityProfileQualities(page, localId, profileName);
		const originalOrder = await getQualityOrder(page);
		expect(originalOrder.length).toBeGreaterThanOrEqual(3);

		// Local: create a group from the first two qualities
		const [member1, member2] = await createGroupFromFirstTwo(page);
		const localOrder = await getQualityOrder(page);

		// Verify group was created somewhere in the list
		expect(localOrder).toContain(GROUP_NAME);
		// The list should be shorter (two items merged into one group)
		expect(localOrder.length).toBe(originalOrder.length - 1);

		// Save
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: reorder — move first item down two positions
		await goToQualitiesMobile(page, devId, profileName);
		await moveQualityDown(page, 0);
		await moveQualityDown(page, 1);
		const devOrder = await getQualityOrder(page);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await restoreDesktop(page);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.28 qp qualities add group vs reorder');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: local list with group wins
		await goToQualityProfileQualities(page, localId, profileName);
		const finalOrder = await getQualityOrder(page);

		// The group should still be present
		expect(finalOrder).toContain(GROUP_NAME);
		// List length should match local (group merged two items)
		expect(finalOrder.length).toBe(localOrder.length);

		// Verify group has members by switching to mobile and checking member text
		await page.setViewportSize(MOBILE_VIEWPORT);
		await page.waitForTimeout(300);
		const rows = page.locator('div.space-y-4 > div[role="button"]');
		const groupRow = rows.filter({ hasText: GROUP_NAME }).first();
		const memberText = groupRow.locator('div.text-sm.text-neutral-900').first();
		const members = await memberText.innerText();
		expect(members).toContain(member1);
		expect(members).toContain(member2);
		await restoreDesktop(page);
	});

	test('b) align — upstream order without group', async ({ page }) => {
		// Navigate to qualities page
		await goToQualityProfileQualities(page, localId, profileName);
		const originalOrder = await getQualityOrder(page);
		expect(originalOrder.length).toBeGreaterThanOrEqual(3);

		// Local: create a group from the first two qualities
		await createGroupFromFirstTwo(page);

		// Save
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: reorder — move first item down two positions
		await goToQualitiesMobile(page, devId, profileName);
		await moveQualityDown(page, 0);
		await moveQualityDown(page, 1);
		const devOrder = await getQualityOrder(page);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await restoreDesktop(page);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.28 qp qualities add group vs reorder');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream order wins — no group, individual qualities in dev order
		await goToQualityProfileQualities(page, localId, profileName);
		const finalOrder = await getQualityOrder(page);

		// Group should NOT be present
		expect(finalOrder).not.toContain(GROUP_NAME);
		// Length should match original (no group merging)
		expect(finalOrder.length).toBe(originalOrder.length);
		// First three items should match dev order
		expect(finalOrder[0]).toBe(devOrder[0]);
		expect(finalOrder[1]).toBe(devOrder[1]);
		expect(finalOrder[2]).toBe(devOrder[2]);
	});
});
