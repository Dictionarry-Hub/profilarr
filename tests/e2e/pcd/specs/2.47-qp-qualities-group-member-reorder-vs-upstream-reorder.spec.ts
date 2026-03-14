/**
 * 2.47 Quality Profile — group member reorder vs upstream reorder conflict
 *
 * Setup: DEV creates a quality group from three qualities and pushes.
 *        LOCAL pulls so both have the same group.
 *        LOCAL reorders the group members one way.
 *        DEV reorders the same group members a different way and pushes.
 * Conflict: guard_mismatch — both sides changed the same group's member order.
 *
 * a) Ask → conflict appears on pull
 * b) Override → local group member order wins
 * c) Align → upstream group member order wins
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
const GROUP_NAME = 'E2E Member Order Group';
const MOBILE_VIEWPORT = { width: 600, height: 800 };
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function createGroupFromFirstThree(page: Page): Promise<string[]> {
	const createGroupButton = page.getByRole('button', { name: 'Create Group' });
	await expect(createGroupButton).toBeVisible();
	await expect(createGroupButton).toBeEnabled();
	await createGroupButton.click();

	const modal = page.getByRole('dialog');
	await modal.waitFor({ state: 'visible' });
	await modal.getByRole('textbox', { name: 'Group Name' }).fill(GROUP_NAME);

	const rows = modal.locator('[data-group-modal-index][role="button"]');
	const members: string[] = [];
	for (let i = 0; i < 3; i++) {
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
		.filter({ hasText: new RegExp(`^${escapeRegex(groupName)}$|${escapeRegex(groupName)}`) })
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

async function moveMemberToward(
	page: Page,
	modal: Locator,
	sourceName: string,
	direction: 'up' | 'down'
): Promise<void> {
	const sourceRow = modal.locator(
		`[data-group-modal-index][data-group-modal-name="${sourceName}"][role="button"]`
	);

	await sourceRow
		.getByRole('button', { name: direction === 'up' ? 'Move member up' : 'Move member down' })
		.click();
	await page.waitForTimeout(200);
}

async function reorderMembersTo(page: Page, modal: Locator, desiredOrder: string[]): Promise<void> {
	for (let guard = 0; guard < 12; guard++) {
		const currentOrder = await getSelectedMemberOrder(modal);
		if (JSON.stringify(currentOrder) === JSON.stringify(desiredOrder)) {
			return;
		}

		let moved = false;
		for (let i = 0; i < desiredOrder.length; i++) {
			if (currentOrder[i] === desiredOrder[i]) continue;
			const sourceName = desiredOrder[i];
			const currentIndex = currentOrder.indexOf(sourceName);
			if (currentIndex === -1) {
				throw new Error(`Member "${sourceName}" not found in modal order`);
			}
			while (currentIndex > i) {
				await moveMemberToward(page, modal, sourceName, 'up');
				moved = true;
				break;
			}
			if (moved) break;
		}
		if (!moved) break;
	}

	throw new Error(`Failed to reorder members to ${desiredOrder.join(', ')}`);
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
	const members = await createGroupFromFirstThree(page);
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');

	await exportAndPush(page, devId, 'e2e: 2.47 create group base');
	await pullChanges(page, localId);

	return members;
}

async function reorderGroupMembers(
	page: Page,
	databaseId: number,
	profileName: string,
	groupName: string,
	desiredOrder: string[]
): Promise<string[]> {
	await goToQualityProfileQualities(page, databaseId, profileName);
	await page.setViewportSize(MOBILE_VIEWPORT);
	await page.waitForTimeout(300);
	const modal = await openEditGroupModal(page, groupName);
	await reorderMembersTo(page, modal, desiredOrder);
	const reordered = await getSelectedMemberOrder(modal);
	await saveGroupAndPage(page, modal);
	await page.setViewportSize(DESKTOP_VIEWPORT);
	return reordered;
}

test.describe('2.47 QP group member reorder vs upstream reorder conflict', () => {
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

		await reorderGroupMembers(page, localId, profileName, GROUP_NAME, [
			members[2],
			members[0],
			members[1]
		]);
		await reorderGroupMembers(page, devId, profileName, GROUP_NAME, [
			members[1],
			members[2],
			members[0]
		]);

		await exportAndPush(page, devId, 'e2e: 2.47 group member reorder vs reorder');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, profileName);
	});

	test('b) override — local member order wins', async ({ page }) => {
		const members = await setupBaseGroup(page, localId, devId, profileName);

		const localOrder = await reorderGroupMembers(page, localId, profileName, GROUP_NAME, [
			members[2],
			members[0],
			members[1]
		]);
		await reorderGroupMembers(page, devId, profileName, GROUP_NAME, [
			members[1],
			members[2],
			members[0]
		]);

		await exportAndPush(page, devId, 'e2e: 2.47 group member reorder vs reorder');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, profileName);
		await overrideConflict(page, profileName);

		await goToQualityProfileQualities(page, localId, profileName);
		const modal = await openEditGroupModal(page, GROUP_NAME);
		const finalOrder = await getSelectedMemberOrder(modal);
		expect(finalOrder).toEqual(localOrder);
		await modal.getByRole('button', { name: 'Cancel' }).click();
		await modal.waitFor({ state: 'hidden' });
	});

	test('c) align — upstream member order wins', async ({ page }) => {
		const members = await setupBaseGroup(page, localId, devId, profileName);

		await reorderGroupMembers(page, localId, profileName, GROUP_NAME, [
			members[2],
			members[0],
			members[1]
		]);
		const devOrder = await reorderGroupMembers(page, devId, profileName, GROUP_NAME, [
			members[1],
			members[2],
			members[0]
		]);

		await exportAndPush(page, devId, 'e2e: 2.47 group member reorder vs reorder');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, profileName);
		await alignConflict(page, profileName);

		await goToQualityProfileQualities(page, localId, profileName);
		const modal = await openEditGroupModal(page, GROUP_NAME);
		const finalOrder = await getSelectedMemberOrder(modal);
		expect(finalOrder).toEqual(devOrder);
		await modal.getByRole('button', { name: 'Cancel' }).click();
		await modal.waitFor({ state: 'hidden' });
	});
});
