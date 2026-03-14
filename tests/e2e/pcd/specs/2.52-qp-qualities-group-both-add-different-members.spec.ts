/**
 * 2.52 Quality Profile — both sides add different members to a group
 *
 * Setup: DEV creates a quality group from two qualities and pushes.
 *        LOCAL pulls so both have the same group.
 *        LOCAL adds member C to the group.
 *        DEV adds member D to the same group and pushes.
 * Conflict: guard_mismatch — local guard expects 2 members,
 *           but upstream now has 3 (with D instead of C).
 *
 * a) Ask → conflict appears on pull
 * b) Override → local group [A, B, C] wins
 * c) Align → upstream group [A, B, D] wins
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
import { openFirstQualityProfileGeneral, goToQualityProfileQualities } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const GROUP_NAME = 'E2E Both Add Group';
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function createGroupFromFirstTwo(page: Page): Promise<string[]> {
	const createGroupButton = page.getByRole('button', { name: 'Create Group' });
	await expect(createGroupButton).toBeVisible();
	await expect(createGroupButton).toBeEnabled();
	await createGroupButton.click();

	const modal = page.getByRole('dialog');
	await modal.waitFor({ state: 'visible' });
	await modal.getByRole('textbox', { name: 'Group Name' }).fill(GROUP_NAME);

	const rows = modal.locator('[data-group-modal-index][role="button"]');
	const members: string[] = [];
	for (let i = 0; i < 2; i++) {
		const row = rows.nth(i);
		members.push((await row.locator('div.truncate').first().innerText()).trim());
		await row.click();
	}

	await modal.getByRole('button', { name: 'Create Group' }).click();
	await modal.waitFor({ state: 'hidden' });

	return members;
}

async function openEditGroupModal(page: Page, groupName: string): Promise<Locator> {
	const rows = page.locator('div.space-y-4 > div[role="button"]');
	const groupRow = rows
		.filter({
			hasText: new RegExp(`^${escapeRegex(groupName)}$|${escapeRegex(groupName)}`)
		})
		.first();
	await groupRow.getByRole('button', { name: groupName, exact: true }).click();

	const modal = page.getByRole('dialog');
	await modal.waitFor({ state: 'visible' });
	return modal;
}

async function getSelectedMemberOrder(modal: Locator): Promise<string[]> {
	return modal
		.locator('[data-group-modal-index][data-group-modal-selected="true"]')
		.evaluateAll((rows) =>
			rows.map((row) => row.getAttribute('data-group-modal-name') ?? '').filter(Boolean)
		);
}

async function saveGroupAndPage(page: Page, modal: Locator): Promise<void> {
	await modal.getByRole('button', { name: 'Save Group' }).click();
	await modal.waitFor({ state: 'hidden' });
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');
}

async function setupBaseGroup(
	page: Page,
	localId: number,
	devId: number,
	profileName: string
): Promise<string[]> {
	await goToQualityProfileQualities(page, devId, profileName);
	const members = await createGroupFromFirstTwo(page);
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');

	await exportAndPush(page, devId, 'e2e: 2.52 create group base');
	await pullChanges(page, localId);

	return members;
}

/** Return the name of the first unselected quality in the edit group modal. */
async function getFirstUnselectedMember(modal: Locator): Promise<string> {
	const row = modal.locator('[data-group-modal-index][data-group-modal-selected="false"]').first();
	const name = await row.getAttribute('data-group-modal-name');
	if (!name) throw new Error('No unselected member found in group modal');
	return name;
}

/** Return the name of the second unselected quality in the edit group modal. */
async function getSecondUnselectedMember(modal: Locator): Promise<string> {
	const row = modal.locator('[data-group-modal-index][data-group-modal-selected="false"]').nth(1);
	const name = await row.getAttribute('data-group-modal-name');
	if (!name) throw new Error('No second unselected member found in group modal');
	return name;
}

/**
 * Add a member to an existing group by name.
 * Opens the edit modal, clicks the target row to select it, and saves.
 * Returns the resulting selected member order.
 */
async function addMemberToGroup(
	page: Page,
	databaseId: number,
	profileName: string,
	groupName: string,
	memberName: string
): Promise<string[]> {
	await goToQualityProfileQualities(page, databaseId, profileName);
	const modal = await openEditGroupModal(page, groupName);

	const targetRow = modal.locator(
		`[data-group-modal-index][data-group-modal-name="${memberName}"][role="button"]`
	);
	await targetRow.click();
	await page.waitForTimeout(200);

	const finalOrder = await getSelectedMemberOrder(modal);
	await saveGroupAndPage(page, modal);
	return finalOrder;
}

/**
 * Discover the first two available (unselected) members for a group.
 * Opens the edit modal, reads names, then cancels.
 */
async function discoverTwoUnselectedMembers(
	page: Page,
	databaseId: number,
	profileName: string,
	groupName: string
): Promise<[string, string]> {
	await goToQualityProfileQualities(page, databaseId, profileName);
	const modal = await openEditGroupModal(page, groupName);
	const first = await getFirstUnselectedMember(modal);
	const second = await getSecondUnselectedMember(modal);
	await modal.getByRole('button', { name: 'Cancel' }).click();
	await modal.waitFor({ state: 'hidden' });
	return [first, second];
}

test.describe('2.52 QP group both sides add different members conflict', () => {
	test.describe.configure({ timeout: 150_000 });

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

	test('a) ask — conflict appears on pull', async ({ page }) => {
		const members = await setupBaseGroup(page, localId, devId, profileName);

		// Discover two available qualities before either side diverges.
		const [memberC, memberD] = await discoverTwoUnselectedMembers(
			page,
			devId,
			profileName,
			GROUP_NAME
		);

		// Local adds member C.
		await addMemberToGroup(page, localId, profileName, GROUP_NAME, memberC);

		// Dev adds member D.
		await addMemberToGroup(page, devId, profileName, GROUP_NAME, memberD);

		await exportAndPush(page, devId, 'e2e: 2.52 both add different members');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, profileName);
	});

	test('b) override — local group with C wins', async ({ page }) => {
		const members = await setupBaseGroup(page, localId, devId, profileName);

		const [memberC, memberD] = await discoverTwoUnselectedMembers(
			page,
			devId,
			profileName,
			GROUP_NAME
		);

		const localOrder = await addMemberToGroup(page, localId, profileName, GROUP_NAME, memberC);

		await addMemberToGroup(page, devId, profileName, GROUP_NAME, memberD);

		await exportAndPush(page, devId, 'e2e: 2.52 both add different members');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, profileName);
		await overrideConflict(page, profileName);

		// Local's group [A, B, C] wins — D not present.
		await goToQualityProfileQualities(page, localId, profileName);
		const modal = await openEditGroupModal(page, GROUP_NAME);
		const finalOrder = await getSelectedMemberOrder(modal);
		expect(finalOrder).toEqual(localOrder);
		expect(finalOrder).toContain(memberC);
		expect(finalOrder).not.toContain(memberD);
		await modal.getByRole('button', { name: 'Cancel' }).click();
		await modal.waitFor({ state: 'hidden' });
	});

	test('c) align — upstream group with D wins', async ({ page }) => {
		const members = await setupBaseGroup(page, localId, devId, profileName);

		const [memberC, memberD] = await discoverTwoUnselectedMembers(
			page,
			devId,
			profileName,
			GROUP_NAME
		);

		await addMemberToGroup(page, localId, profileName, GROUP_NAME, memberC);

		const devOrder = await addMemberToGroup(page, devId, profileName, GROUP_NAME, memberD);

		await exportAndPush(page, devId, 'e2e: 2.52 both add different members');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, profileName);
		await alignConflict(page, profileName);

		// Upstream's group [A, B, D] wins — C not present.
		await goToQualityProfileQualities(page, localId, profileName);
		const modal = await openEditGroupModal(page, GROUP_NAME);
		const finalOrder = await getSelectedMemberOrder(modal);
		expect(finalOrder).toEqual(devOrder);
		expect(finalOrder).toContain(memberD);
		expect(finalOrder).not.toContain(memberC);
		await modal.getByRole('button', { name: 'Cancel' }).click();
		await modal.waitFor({ state: 'hidden' });
	});
});
