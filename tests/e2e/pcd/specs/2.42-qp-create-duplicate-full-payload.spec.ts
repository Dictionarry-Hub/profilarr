/**
 * 2.42 Quality Profile — create duplicate (full payload: general+qualities+scoring)
 *
 * Setup: Local creates QP, then edits scoring (minimumScore=50) and
 *        reorders qualities (move first down one).
 *        Dev creates same-named QP with different description,
 *        minimumScore=100, and a different quality reorder (first down two).
 *        Dev pushes.
 * Conflict: duplicate_key on CREATE + guard_mismatch on qualities + scoring.
 *
 * a) Override all → local description, local minimumScore, local qualities order
 * b) Align all → upstream description, upstream minimumScore, upstream qualities order
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
	alignConflict,
	findConflictRow
} from '../helpers/conflicts';
import {
	goToQualityProfileGeneral,
	goToQualityProfileQualities,
	goToQualityProfileScoring
} from '../helpers/entity';
import { fillMarkdownInput } from '../helpers/markdown';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const QP_NAME_PREFIX = 'E2E Dup Full 2.42';
const LOCAL_DESCRIPTION = 'Local full payload desc 2.42';
const DEV_DESCRIPTION = 'Dev full payload desc 2.42';
const LOCAL_MIN_SCORE = 50;
const DEV_MIN_SCORE = 100;
const MOBILE_VIEWPORT = { width: 600, height: 800 };
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

async function createQualityProfile(
	page: import('@playwright/test').Page,
	databaseId: number,
	name: string,
	description: string
): Promise<void> {
	await page.goto(`/quality-profiles/${databaseId}/new`);
	await page.waitForLoadState('networkidle');
	await page.locator('input[name="name"]').fill(name);
	await fillMarkdownInput(page, 'description', description);
	await page.getByRole('button', { name: 'Create' }).click();
	await page.waitForURL(new RegExp(`/quality-profiles/${databaseId}/\\d+/scoring`), {
		timeout: 15_000
	});
	await page.waitForLoadState('networkidle');
}

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
	const mobileButtons = row.locator('.md\\:hidden button');
	await mobileButtons.last().click();
	await page.waitForTimeout(200);
}

/** Override or align all conflict rows for an entity until none remain.
 *  Reloads the conflicts page between rounds so recompile-generated
 *  conflicts are picked up (avoids race where count briefly hits 0).
 *  Returns the number of rounds executed.
 */
async function resolveAllConflicts(
	page: import('@playwright/test').Page,
	databaseId: number,
	entityName: string,
	action: 'Override' | 'Align'
): Promise<number> {
	const resolve = action === 'Override' ? overrideConflict : alignConflict;
	let round = 0;
	for (; round < 10; round++) {
		await page.goto(`/databases/${databaseId}/conflicts`);
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);
		const count = await findConflictRow(page, entityName).count();
		if (count === 0) break;
		await resolve(page, entityName);
	}
	return round;
}

test.describe('2.42 QP create duplicate (full payload)', () => {
	test.describe.configure({ timeout: 180_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let testQpName: string;

	test.beforeEach(async ({ browser }) => {
		const page = await browser.newPage();
		const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		testQpName = `${QP_NAME_PREFIX} ${runId}`;

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

	test('a) override — local full state wins', async ({ page }) => {
		// --- Local: create QP → edit scoring → edit qualities ---

		await createQualityProfile(page, localId, testQpName, LOCAL_DESCRIPTION);

		// Already on scoring page after create — change minimumScore
		const localMinInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		await expect(localMinInput).toBeVisible({ timeout: 10_000 });
		await localMinInput.fill(String(LOCAL_MIN_SCORE));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Switch to qualities page (mobile viewport for move buttons)
		await goToQualityProfileQualities(page, localId, testQpName);
		await page.setViewportSize(MOBILE_VIEWPORT);
		await page.waitForTimeout(300);
		const originalOrder = await getQualityOrder(page);
		expect(originalOrder.length).toBeGreaterThanOrEqual(3);

		// Local: move first quality down one position
		await moveQualityDown(page, 0);
		const localOrder = await getQualityOrder(page);
		expect(localOrder[0]).toBe(originalOrder[1]);
		expect(localOrder[1]).toBe(originalOrder[0]);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await page.setViewportSize(DESKTOP_VIEWPORT);

		// Verify quality reorder was saved by reloading
		await goToQualityProfileQualities(page, localId, testQpName);
		const savedOrder = await getQualityOrder(page);
		expect(savedOrder[0]).toBe(localOrder[0]);
		expect(savedOrder[1]).toBe(localOrder[1]);

		// --- Dev: create same-named QP → edit scoring → edit qualities ---

		await createQualityProfile(page, devId, testQpName, DEV_DESCRIPTION);

		// Dev: change minimumScore
		const devMinInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		await expect(devMinInput).toBeVisible({ timeout: 10_000 });
		await devMinInput.fill(String(DEV_MIN_SCORE));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: reorder qualities (move first down two)
		await goToQualityProfileQualities(page, devId, testQpName);
		await page.setViewportSize(MOBILE_VIEWPORT);
		await page.waitForTimeout(300);
		await moveQualityDown(page, 0);
		await moveQualityDown(page, 1);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await page.setViewportSize(DESKTOP_VIEWPORT);

		// --- Push upstream ---
		await exportAndPush(page, devId, 'e2e: 2.42 create duplicate full payload');

		// --- Pull into local → conflict(s) ---
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, testQpName);

		// Expect at least 2 conflicts (CREATE + scoring; qualities may also conflict)
		const initialConflicts = await findConflictRow(page, testQpName).count();
		expect(initialConflicts).toBeGreaterThanOrEqual(2);

		// Override all conflicts for this entity
		const rounds = await resolveAllConflicts(page, localId, testQpName, 'Override');
		expect(rounds).toBeGreaterThanOrEqual(2);

		// Verify all conflicts resolved
		await page.goto(`/databases/${localId}/conflicts`);
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);
		expect(await findConflictRow(page, testQpName).count()).toBe(0);

		// --- Verify: local full state ---

		// General: local description
		await goToQualityProfileGeneral(page, localId, testQpName);
		const descText = await page.locator('#description').inputValue();
		expect(descText).toContain(LOCAL_DESCRIPTION);

		// Scoring: local minimumScore
		await goToQualityProfileScoring(page, localId, testQpName);
		const finalMin = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		expect(Number(await finalMin.inputValue())).toBe(LOCAL_MIN_SCORE);

		// Qualities: local order (first two swapped from original)
		await goToQualityProfileQualities(page, localId, testQpName);
		const finalOrder = await getQualityOrder(page);
		expect(finalOrder[0]).toBe(localOrder[0]);
		expect(finalOrder[1]).toBe(localOrder[1]);
	});

	test('b) align — upstream full state wins', async ({ page }) => {
		// --- Local: create QP → edit scoring → edit qualities ---

		await createQualityProfile(page, localId, testQpName, LOCAL_DESCRIPTION);

		const localMinInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		await expect(localMinInput).toBeVisible({ timeout: 10_000 });
		await localMinInput.fill(String(LOCAL_MIN_SCORE));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		await goToQualityProfileQualities(page, localId, testQpName);
		await page.setViewportSize(MOBILE_VIEWPORT);
		await page.waitForTimeout(300);
		await moveQualityDown(page, 0);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await page.setViewportSize(DESKTOP_VIEWPORT);

		// --- Dev: create same-named QP → edit scoring → edit qualities ---

		await createQualityProfile(page, devId, testQpName, DEV_DESCRIPTION);

		const devMinInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		await expect(devMinInput).toBeVisible({ timeout: 10_000 });
		await devMinInput.fill(String(DEV_MIN_SCORE));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		await goToQualityProfileQualities(page, devId, testQpName);
		await page.setViewportSize(MOBILE_VIEWPORT);
		await page.waitForTimeout(300);
		await moveQualityDown(page, 0);
		await moveQualityDown(page, 1);
		const devOrder = await getQualityOrder(page);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await page.setViewportSize(DESKTOP_VIEWPORT);

		// --- Push upstream ---
		await exportAndPush(page, devId, 'e2e: 2.42 create duplicate full payload');

		// --- Pull into local → conflict(s) ---
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, testQpName);

		// Align all conflicts for this entity
		const rounds = await resolveAllConflicts(page, localId, testQpName, 'Align');
		expect(rounds).toBeGreaterThanOrEqual(1);

		// Verify all conflicts resolved
		await page.goto(`/databases/${localId}/conflicts`);
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);
		expect(await findConflictRow(page, testQpName).count()).toBe(0);

		// --- Verify: upstream full state ---

		// General: upstream description
		await goToQualityProfileGeneral(page, localId, testQpName);
		const descText = await page.locator('#description').inputValue();
		expect(descText).toContain(DEV_DESCRIPTION);

		// Scoring: upstream minimumScore
		await goToQualityProfileScoring(page, localId, testQpName);
		const finalMin = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		expect(Number(await finalMin.inputValue())).toBe(DEV_MIN_SCORE);

		// Qualities: upstream order
		await goToQualityProfileQualities(page, localId, testQpName);
		const finalOrder = await getQualityOrder(page);
		expect(finalOrder[0]).toBe(devOrder[0]);
		expect(finalOrder[1]).toBe(devOrder[1]);
		expect(finalOrder[2]).toBe(devOrder[2]);
	});
});
