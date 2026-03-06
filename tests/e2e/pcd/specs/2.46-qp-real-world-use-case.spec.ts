/**
 * 2.46 Quality Profile — real world use case (multi-surface conflict)
 *
 * Setup: Local makes complex changes across all three QP surfaces
 *        (general, scoring, qualities) for "1080p Balanced" profile.
 *        Dev makes overlapping changes to the same profile, plus some
 *        non-overlapping changes (tag, upgradeUntilScore, NF, ATVP).
 *        Dev pushes, local pulls.
 *
 * Conflicts (6 ops):
 *   description, minimumScore, SHO+radarr, SHO+sonarr, DRPO+radarr, qualities
 *   (qualities conflicts because local adds HDTV-1080p to group; full-replace surface)
 *
 * Non-conflicting dev changes (should apply cleanly):
 *   tag "Recommended", upgradeUntilScore=50000, NF radarr=500, ATVP sonarr=750
 *
 * a) Ask strategy — conflicts appear on pull; non-conflicting changes apply
 * b) Override strategy — conflicts auto-resolve; local desired values win
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
	findConflictRow,
	getConflictCount
} from '../helpers/conflicts';
import {
	goToQualityProfileGeneral,
	goToQualityProfileScoring,
	goToQualityProfileQualities,
	addQpTag
} from '../helpers/entity';
import { fillMarkdownInput } from '../helpers/markdown';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const PROFILE_NAME = '1080p Balanced';
const MOBILE_VIEWPORT = { width: 600, height: 800 };
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
const PRERELEASE_MEMBERS = ['CAM', 'DVDSCR', 'REGIONAL', 'TELECINE', 'TELESYNC', 'WORKPRINT'];

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Select a language from the QP general form dropdown (does NOT save). */
async function setQpLanguage(page: Page, language: string): Promise<void> {
	const input = page.locator('input[name="language-search"]');
	await input.fill(language);
	await page.locator('button', { hasText: language }).first().click();
}

/** Read the ordered quality/group names from the qualities page. */
async function getQualityOrder(page: Page): Promise<string[]> {
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
async function moveQualityDown(page: Page, index: number): Promise<void> {
	const row = page.locator('div.space-y-4 > div[role="button"]').nth(index);
	const mobileButtons = row.locator('.md\\:hidden button');
	await mobileButtons.last().click();
	await page.waitForTimeout(200);
}

/** Click the move-up button on a quality row (mobile view). */
async function moveQualityUp(page: Page, index: number): Promise<void> {
	const row = page.locator('div.space-y-4 > div[role="button"]').nth(index);
	const mobileButtons = row.locator('.md\\:hidden button');
	const count = await mobileButtons.count();
	// ChevronUp is always second-to-last (before ChevronDown)
	await mobileButtons.nth(count - 2).click();
	await page.waitForTimeout(200);
}

/** Get score cell locators for a specific column index (1-based). */
function getScoreCellLocators(
	row: Locator,
	colIndex: number
): { enabledCheckbox: Locator; scoreInput: Locator } {
	const scoreCell = row.locator('td').nth(colIndex);
	return {
		enabledCheckbox: scoreCell.locator('[role="checkbox"]').first(),
		scoreInput: scoreCell.locator('input[type="number"]').first()
	};
}

/** Find a scoring row by format name and return locators for a given column. */
async function findScoringCellByFormat(
	page: Page,
	formatName: string,
	colIndex: number
): Promise<{ enabledCheckbox: Locator; scoreInput: Locator }> {
	// Filter the scoring table via the search box
	const searchInput = page.getByPlaceholder(/search custom formats/i);
	await searchInput.fill(formatName);
	await page.waitForTimeout(500);

	const exact = new RegExp(`^${escapeRegex(formatName)}$`);
	const row = page
		.locator('table tbody tr')
		.filter({ has: page.locator('td').first().filter({ hasText: exact }) })
		.first();
	await expect(row).toBeVisible({ timeout: 15_000 });
	return getScoreCellLocators(row, colIndex);
}

/** Create a quality group via the modal, selecting specific members by name. */
async function createGroup(page: Page, name: string, memberNames: string[]): Promise<void> {
	await page.getByRole('button', { name: 'Create Group' }).click();

	const modal = page.getByRole('dialog');
	await modal.waitFor({ state: 'visible' });

	await modal.getByRole('textbox', { name: 'Group Name' }).fill(name);

	const qualityButtons = modal.locator('button').filter({
		has: page.locator('[role="checkbox"]')
	});
	const count = await qualityButtons.count();
	for (let i = 0; i < count; i++) {
		const btn = qualityButtons.nth(i);
		const text = (await btn.innerText()).trim();
		if (memberNames.includes(text)) {
			await btn.click();
		}
	}

	await modal.getByRole('button', { name: 'Create Group' }).click();
	await modal.waitFor({ state: 'hidden' });
}

/**
 * Edit a quality group's members via the edit modal.
 * Opens the modal by clicking the group name, toggles checkboxes to keep
 * only the specified members, and confirms.
 */
async function editGroupMembers(
	page: Page,
	groupName: string,
	keepMembers: string[]
): Promise<void> {
	// Click the group name span to open edit modal
	const rows = page.locator('div.space-y-4 > div[role="button"]');
	const groupRow = rows.filter({ hasText: groupName }).first();
	await groupRow.locator('span.cursor-pointer').first().click();

	const modal = page.getByRole('dialog');
	await modal.waitFor({ state: 'visible' });

	const qualityButtons = modal.locator('button').filter({
		has: page.locator('[role="checkbox"]')
	});
	const count = await qualityButtons.count();
	for (let i = 0; i < count; i++) {
		const btn = qualityButtons.nth(i);
		const text = (await btn.innerText()).trim();
		const checkbox = btn.locator('[role="checkbox"]');
		const isChecked = (await checkbox.getAttribute('aria-checked')) === 'true';

		if (keepMembers.includes(text)) {
			if (!isChecked) await btn.click();
		} else {
			if (isChecked) await btn.click();
		}
	}

	await modal.getByRole('button', { name: 'Save Group' }).click();
	await modal.waitFor({ state: 'hidden' });
}

/**
 * Ensure the description textarea is in edit mode (visible) and return its
 * current value.
 */
async function readDescription(page: Page): Promise<string> {
	const textarea = page.locator('#description');
	if (!(await textarea.isVisible())) {
		const container = page.locator('.space-y-2:has(label[for="description"])');
		await container.locator('button[title="Edit"]').click();
		await textarea.waitFor({ state: 'visible' });
	}
	return await textarea.inputValue();
}

/** Move a quality item to a target index via mobile viewport buttons. */
async function moveQualityToIndex(page: Page, itemName: string, targetIdx: number): Promise<void> {
	const order = await getQualityOrder(page);
	let idx = order.indexOf(itemName);
	while (idx > targetIdx) {
		await moveQualityUp(page, idx);
		idx--;
	}
	while (idx < targetIdx) {
		await moveQualityDown(page, idx);
		idx++;
	}
}

// ---------------------------------------------------------------------------
// Shared setup: make all changes on both databases, push dev, pull local.
// Returns AMZN scores needed for verification.
// ---------------------------------------------------------------------------

interface SetupResult {
	localId: number;
	amznScore1: string;
	amznScore2: string;
}

async function setupDatabasesAndSync(
	page: Page,
	devId: number,
	conflictStrategy: string
): Promise<SetupResult> {
	// Link local database with the given conflict strategy
	const localId = await linkPcd(page, {
		name: LOCAL_DB_NAME,
		repoUrl: TEST_REPO_URL,
		pat: TEST_PAT,
		gitName: TEST_GIT_NAME,
		gitEmail: TEST_GIT_EMAIL,
		syncStrategy: 'Manual (no auto-sync)',
		autoPull: false,
		localOpsEnabled: true,
		conflictStrategy
	});

	// ─── 1. LOCAL: General tab changes ─────────────────────────────────

	await goToQualityProfileGeneral(page, localId, PROFILE_NAME);

	// Language: Any → Chinese
	await setQpLanguage(page, 'Chinese');

	// Tag: add "Streaming Optimised"
	await addQpTag(page, 'Streaming Optimised');

	// Description: insert "Chinese" before "1080p **WEB-DLs**"
	const currentDesc = await readDescription(page);
	const newDesc = currentDesc.replace('1080p **WEB-DLs**', 'Chinese 1080p **WEB-DLs**');
	await fillMarkdownInput(page, 'description', newDesc);

	// Save general changes
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');

	// ─── 2. LOCAL: Scoring tab changes ─────────────────────────────────

	await goToQualityProfileScoring(page, localId, PROFILE_NAME);

	// minimumScore = 0
	const localMinInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
	await expect(localMinInput).toBeVisible({ timeout: 10_000 });
	await localMinInput.fill('0');

	// upgradeScoreIncrement = 10000
	const localIncrInput = page.locator('input[name="upgradeScoreIncrement"]:not([type="hidden"])');
	await expect(localIncrInput).toBeVisible({ timeout: 10_000 });
	await localIncrInput.fill('10000');

	// Read AMZN scores (radarr col 1, sonarr col 2)
	const amznCol1 = await findScoringCellByFormat(page, 'AMZN', 1);
	const amznScore1 = await amznCol1.scoreInput.inputValue();
	const amznCol2 = await findScoringCellByFormat(page, 'AMZN', 2);
	const amznScore2 = await amznCol2.scoreInput.inputValue();

	// Set MUBI, SHO, DRPO to AMZN values (both columns)
	for (const name of ['MUBI', 'SHO', 'DRPO']) {
		const cell1 = await findScoringCellByFormat(page, name, 1);
		await cell1.scoreInput.fill(amznScore1);
		const cell2 = await findScoringCellByFormat(page, name, 2);
		await cell2.scoreInput.fill(amznScore2);
	}

	// Set h265, x265 to 0 (both columns)
	for (const name of ['h265', 'x265']) {
		const cell1 = await findScoringCellByFormat(page, name, 1);
		await cell1.scoreInput.fill('0');
		const cell2 = await findScoringCellByFormat(page, name, 2);
		await cell2.scoreInput.fill('0');
	}

	// Save scoring changes
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');

	// ─── 3. LOCAL: Qualities tab changes ───────────────────────────────

	await goToQualityProfileQualities(page, localId, PROFILE_NAME);

	// Edit "1080p Balanced" group: add HDTV-1080p to existing members
	await editGroupMembers(page, PROFILE_NAME, ['Bluray-1080p', 'WEBDL-1080p', 'HDTV-1080p']);

	// Create "Prereleases" group
	await createGroup(page, 'Prereleases', PRERELEASE_MEMBERS);

	// Move Prereleases to position 3 (1080p Balanced > 720p Quality > 480p Quality > Prereleases)
	await page.setViewportSize(MOBILE_VIEWPORT);
	await page.waitForTimeout(300);
	await moveQualityToIndex(page, 'Prereleases', 3);

	// Save qualities changes
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');
	await page.setViewportSize(DESKTOP_VIEWPORT);

	// ─── 4. DEV: General tab changes ───────────────────────────────────

	await goToQualityProfileGeneral(page, devId, PROFILE_NAME);

	// Description: replace "4 to 8gb" with "4 to 10gb"
	const devCurrentDesc = await readDescription(page);
	const devNewDesc = devCurrentDesc.replace('4 to 8gb', '4 to 10gb');
	await fillMarkdownInput(page, 'description', devNewDesc);

	// Tag: add "Recommended" (non-conflicting — tags have no value guards)
	await addQpTag(page, 'Recommended');

	// Save
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');

	// ─── 5. DEV: Scoring tab changes ───────────────────────────────────

	await goToQualityProfileScoring(page, devId, PROFILE_NAME);

	// minimumScore = 10000
	const devMinInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
	await expect(devMinInput).toBeVisible({ timeout: 10_000 });
	await devMinInput.fill('10000');

	// upgradeUntilScore = 50000 (non-conflicting — local didn't touch this)
	const devUntilInput = page.locator('input[name="upgradeUntilScore"]:not([type="hidden"])');
	await expect(devUntilInput).toBeVisible({ timeout: 10_000 });
	await devUntilInput.fill('50000');

	// SHO scores = -250 (both radarr + sonarr)
	const shoCell1 = await findScoringCellByFormat(page, 'SHO', 1);
	await shoCell1.scoreInput.fill('-250');
	const shoCell2 = await findScoringCellByFormat(page, 'SHO', 2);
	await shoCell2.scoreInput.fill('-250');

	// DRPO radarr only = 150
	const drpoCell1 = await findScoringCellByFormat(page, 'DRPO', 1);
	await drpoCell1.scoreInput.fill('150');

	// NF radarr = 500 (non-conflicting — local didn't touch NF)
	const nfCell1 = await findScoringCellByFormat(page, 'NF', 1);
	await nfCell1.scoreInput.fill('500');

	// ATVP sonarr = 750 (non-conflicting — local didn't touch ATVP)
	const atvpCell2 = await findScoringCellByFormat(page, 'ATVP', 2);
	await atvpCell2.scoreInput.fill('750');

	// Save
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');

	// ─── 6. DEV: Qualities tab changes ─────────────────────────────────

	await goToQualityProfileQualities(page, devId, PROFILE_NAME);

	// Create "Prereleases" group with same members
	await createGroup(page, 'Prereleases', PRERELEASE_MEMBERS);

	// Move Prereleases to position 3 (same as local)
	await page.setViewportSize(MOBILE_VIEWPORT);
	await page.waitForTimeout(300);
	await moveQualityToIndex(page, 'Prereleases', 3);

	// Save
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');
	await page.setViewportSize(DESKTOP_VIEWPORT);

	// ─── 7. Push dev changes ───────────────────────────────────────────

	await exportAndPush(page, devId, 'e2e: 2.46 real world use case');

	// ─── 8. Pull into local ────────────────────────────────────────────

	await pullChanges(page, localId);

	return { localId, amznScore1, amznScore2 };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('2.46 QP real world use case — multi-surface conflict', () => {
	test.describe.configure({ timeout: 240_000 });

	let localId: number;
	let devId: number;
	let devHead: string;

	test.beforeEach(async ({ browser }) => {
		const page = await browser.newPage();

		await unlinkPcdByName(page, LOCAL_DB_NAME);
		await unlinkPcdByName(page, DEV_DB_NAME);

		// Link dev first and capture HEAD so afterEach can always reset,
		// even if the test itself fails partway through.
		devId = await linkPcd(page, {
			name: DEV_DB_NAME,
			repoUrl: TEST_REPO_URL,
			pat: TEST_PAT,
			gitName: TEST_GIT_NAME,
			gitEmail: TEST_GIT_EMAIL
		});
		devHead = getHead(devId);

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

	test('a) ask strategy — conflicts appear on pull', async ({ page }) => {
		const result = await setupDatabasesAndSync(page, devId, 'Ask every time');
		localId = result.localId;

		// ─── Verify conflicts ──────────────────────────────────────────────

		await goToConflicts(page, localId);
		await expectConflict(page, PROFILE_NAME);

		// Expect 6 conflict rows:
		//   1. description (general)
		//   2. minimumScore (scoring profile field)
		//   3. SHO + radarr (CF score row)
		//   4. SHO + sonarr (CF score row)
		//   5. DRPO + radarr (CF score row)
		//   6. qualities (full-replace surface)
		const conflictCount = await findConflictRow(page, PROFILE_NAME).count();
		expect(conflictCount).toBeGreaterThanOrEqual(6);

		// ─── Verify non-conflicting dev changes applied ────────────────────

		// Scoring: upgradeUntilScore, NF, ATVP from dev should be in base
		await goToQualityProfileScoring(page, localId, PROFILE_NAME);

		const finalUntilInput = page.locator('input[name="upgradeUntilScore"]:not([type="hidden"])');
		expect(Number(await finalUntilInput.inputValue())).toBe(50000);

		const finalNf = await findScoringCellByFormat(page, 'NF', 1);
		expect(Number(await finalNf.scoreInput.inputValue())).toBe(500);

		const finalAtvp = await findScoringCellByFormat(page, 'ATVP', 2);
		expect(Number(await finalAtvp.scoreInput.inputValue())).toBe(750);

		// General: dev's "Recommended" tag should be present (tags merge)
		await goToQualityProfileGeneral(page, localId, PROFILE_NAME);
		const tagContainer = page
			.locator('#tags-input')
			.locator('xpath=ancestor::div[contains(@class,"flex")]');
		await expect(tagContainer.locator('span', { hasText: 'Recommended' }).first()).toBeVisible();
	});

	test('b) override strategy — conflicts auto-resolve, local wins', async ({ page }) => {
		// Override is the default conflict strategy — don't pass it explicitly
		// to avoid re-selecting the already-active dropdown value.
		const result = await setupDatabasesAndSync(page, devId, '');
		localId = result.localId;
		const { amznScore1, amznScore2 } = result;

		// ─── No conflicts should remain (auto-resolve may run async after pull) ──

		await goToConflicts(page, localId);
		await expect
			.poll(
				async () => {
					await page.reload();
					await page.waitForLoadState('networkidle');
					await page.waitForTimeout(1000);
					return await getConflictCount(page);
				},
				{ timeout: 30_000, intervals: [2000, 3000, 5000, 5000] }
			)
			.toBe(0);

		// ─── Conflicting fields: local values win ──────────────────────────

		// General: description has "Chinese", NOT "4 to 10gb"
		await goToQualityProfileGeneral(page, localId, PROFILE_NAME);
		const desc = await readDescription(page);
		expect(desc).toContain('Chinese 1080p');
		expect(desc).toContain('4 to 8gb');

		// General: language = Chinese
		const lang = await page.locator('input[name="language"]').inputValue();
		expect(lang).toBe('Chinese');

		// Scoring: minimumScore = 0 (local), not 10000 (dev)
		await goToQualityProfileScoring(page, localId, PROFILE_NAME);
		const minInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		expect(Number(await minInput.inputValue())).toBe(0);

		// Scoring: SHO = AMZN values (local), not -250 (dev)
		const shoR = await findScoringCellByFormat(page, 'SHO', 1);
		expect(await shoR.scoreInput.inputValue()).toBe(amznScore1);
		const shoS = await findScoringCellByFormat(page, 'SHO', 2);
		expect(await shoS.scoreInput.inputValue()).toBe(amznScore2);

		// Scoring: DRPO radarr = AMZN value (local), not 150 (dev)
		const drpoR = await findScoringCellByFormat(page, 'DRPO', 1);
		expect(await drpoR.scoreInput.inputValue()).toBe(amznScore1);

		// Qualities: HDTV-1080p should be in the 1080p Balanced group (local added it)
		await goToQualityProfileQualities(page, localId, PROFILE_NAME);
		await page.setViewportSize(MOBILE_VIEWPORT);
		await page.waitForTimeout(300);
		const rows = page.locator('div.space-y-4 > div[role="button"]');
		const groupRow = rows.filter({ hasText: PROFILE_NAME }).first();
		const memberText = await groupRow.locator('div.text-sm.text-neutral-900').first().innerText();
		expect(memberText).toContain('HDTV-1080p');
		await page.setViewportSize(DESKTOP_VIEWPORT);

		// ─── Non-conflicting changes: both sides apply ─────────────────────

		// Scoring: upgradeScoreIncrement = 10000 (local, non-conflicting)
		await goToQualityProfileScoring(page, localId, PROFILE_NAME);
		const incrInput = page.locator('input[name="upgradeScoreIncrement"]:not([type="hidden"])');
		expect(Number(await incrInput.inputValue())).toBe(10000);

		// Scoring: upgradeUntilScore = 50000 (dev, non-conflicting)
		const untilInput = page.locator('input[name="upgradeUntilScore"]:not([type="hidden"])');
		expect(Number(await untilInput.inputValue())).toBe(50000);

		// Scoring: NF radarr = 500 (dev, non-conflicting)
		const nfR = await findScoringCellByFormat(page, 'NF', 1);
		expect(Number(await nfR.scoreInput.inputValue())).toBe(500);

		// Scoring: ATVP sonarr = 750 (dev, non-conflicting)
		const atvpS = await findScoringCellByFormat(page, 'ATVP', 2);
		expect(Number(await atvpS.scoreInput.inputValue())).toBe(750);

		// General: both tags present
		await goToQualityProfileGeneral(page, localId, PROFILE_NAME);
		const tagContainer = page
			.locator('#tags-input')
			.locator('xpath=ancestor::div[contains(@class,"flex")]');
		await expect(
			tagContainer.locator('span', { hasText: 'Streaming Optimised' }).first()
		).toBeVisible();
		await expect(tagContainer.locator('span', { hasText: 'Recommended' }).first()).toBeVisible();
	});

	test('c) align strategy — conflicts auto-resolve, upstream wins', async ({ page }) => {
		const result = await setupDatabasesAndSync(page, devId, 'Align');
		localId = result.localId;
		const { amznScore1, amznScore2 } = result;

		// ─── No conflicts should remain (align drops local ops during build) ──

		await goToConflicts(page, localId);
		await expectNoConflict(page, PROFILE_NAME);

		// ─── Conflicting fields: dev/upstream values win ─────────────────────

		// General: description has "4 to 10gb" (dev), NOT "Chinese" (local)
		await goToQualityProfileGeneral(page, localId, PROFILE_NAME);
		const desc = await readDescription(page);
		expect(desc).toContain('4 to 10gb');
		expect(desc).not.toContain('Chinese');

		// Scoring: minimumScore = 10000 (dev), not 0 (local)
		await goToQualityProfileScoring(page, localId, PROFILE_NAME);
		const minInput = page.locator('input[name="minimumScore"]:not([type="hidden"])');
		expect(Number(await minInput.inputValue())).toBe(10000);

		// Scoring: SHO = -250 (dev), not AMZN values (local)
		const shoR = await findScoringCellByFormat(page, 'SHO', 1);
		expect(Number(await shoR.scoreInput.inputValue())).toBe(-250);
		const shoS = await findScoringCellByFormat(page, 'SHO', 2);
		expect(Number(await shoS.scoreInput.inputValue())).toBe(-250);

		// Scoring: DRPO radarr = 150 (dev), not AMZN value (local)
		const drpoR = await findScoringCellByFormat(page, 'DRPO', 1);
		expect(Number(await drpoR.scoreInput.inputValue())).toBe(150);

		// Qualities: HDTV-1080p should NOT be in the 1080p Balanced group (dev's version wins)
		await goToQualityProfileQualities(page, localId, PROFILE_NAME);
		await page.setViewportSize(MOBILE_VIEWPORT);
		await page.waitForTimeout(300);
		const rows = page.locator('div.space-y-4 > div[role="button"]');
		const groupRow = rows.filter({ hasText: PROFILE_NAME }).first();
		const memberText = await groupRow.locator('div.text-sm.text-neutral-900').first().innerText();
		expect(memberText).not.toContain('HDTV-1080p');
		await page.setViewportSize(DESKTOP_VIEWPORT);

		// ─── Non-conflicting changes: both sides apply ───────────────────────

		// Scoring: upgradeScoreIncrement = 10000 (local, non-conflicting)
		await goToQualityProfileScoring(page, localId, PROFILE_NAME);
		const incrInput = page.locator('input[name="upgradeScoreIncrement"]:not([type="hidden"])');
		expect(Number(await incrInput.inputValue())).toBe(10000);

		// Scoring: upgradeUntilScore = 50000 (dev, non-conflicting)
		const untilInput = page.locator('input[name="upgradeUntilScore"]:not([type="hidden"])');
		expect(Number(await untilInput.inputValue())).toBe(50000);

		// Scoring: NF radarr = 500 (dev, non-conflicting)
		const nfR = await findScoringCellByFormat(page, 'NF', 1);
		expect(Number(await nfR.scoreInput.inputValue())).toBe(500);

		// Scoring: ATVP sonarr = 750 (dev, non-conflicting)
		const atvpS = await findScoringCellByFormat(page, 'ATVP', 2);
		expect(Number(await atvpS.scoreInput.inputValue())).toBe(750);

		// General: both tags present (tags merge, no conflict)
		await goToQualityProfileGeneral(page, localId, PROFILE_NAME);
		const tagContainer = page
			.locator('#tags-input')
			.locator('xpath=ancestor::div[contains(@class,"flex")]');
		await expect(
			tagContainer.locator('span', { hasText: 'Streaming Optimised' }).first()
		).toBeVisible();
		await expect(tagContainer.locator('span', { hasText: 'Recommended' }).first()).toBeVisible();

		// General: language = Chinese (local, non-conflicting — dev didn't change language)
		const lang = await page.locator('input[name="language"]').inputValue();
		expect(lang).toBe('Chinese');
	});
});
