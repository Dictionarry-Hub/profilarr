/**
 * 2.20 Quality Profile — upstream rename + local qualities conflict
 *
 * Setup: Local toggles a quality's enabled state. Upstream renames the profile.
 * Conflict: guard_mismatch — user's qualities UPDATE guards on the old name,
 *           which upstream changed.
 *
 * a) Override → upstream name + local qualities
 * b) Align → upstream name + upstream qualities, user op dropped
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
import {
	openFirstQualityProfileGeneral,
	goToQualityProfileGeneral,
	goToQualityProfileQualities,
	updateQpName
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';

test.describe('2.20 QP upstream rename + local qualities conflict', () => {
	test.describe.configure({ timeout: 120_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let profileName: string;
	let targetQualityName: string;
	let originalEnabled: boolean;
	let localEnabled: boolean;

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

	test('a) override — upstream name + local qualities', async ({ page }) => {
		const devName = `${profileName} Dev 2.20`;

		// Local: toggle a quality's enabled state
		await goToQualityProfileQualities(page, localId, profileName);
		const rows = page.locator('div.space-y-4 > div[role="button"]');
		await expect(rows.first()).toBeVisible();

		// Find a non-upgrade-until row to toggle
		const rowCount = await rows.count();
		let targetRow = rows.first();
		for (let i = 0; i < rowCount; i++) {
			const candidate = rows.nth(i);
			const upgradeUntilChecked =
				(await candidate.locator('[role="checkbox"]').first().getAttribute('aria-checked')) ===
				'true';
			if (!upgradeUntilChecked) {
				targetRow = candidate;
				break;
			}
		}

		targetQualityName = (await targetRow.locator('div.font-medium').first().innerText()).trim();
		originalEnabled =
			(await targetRow.locator('[role="checkbox"]').last().getAttribute('aria-checked')) === 'true';
		localEnabled = !originalEnabled;

		await targetRow.click();
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: rename the profile
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpName(page, devName);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.20 qp upstream rename + local qualities');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: upstream name kept
		await goToQualityProfileGeneral(page, localId, devName);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(devName);

		// Verify: local qualities applied
		await goToQualityProfileQualities(page, localId, devName);
		const finalRow = page
			.locator('div.space-y-4 > div[role="button"]')
			.filter({ has: page.locator('div.font-medium', { hasText: targetQualityName }) })
			.first();
		await expect(finalRow).toBeVisible();
		const finalEnabled =
			(await finalRow.locator('[role="checkbox"]').last().getAttribute('aria-checked')) === 'true';
		expect(finalEnabled).toBe(localEnabled);
	});

	test('b) align — upstream name + upstream qualities', async ({ page }) => {
		const devName = `${profileName} Dev 2.20`;

		// Local: toggle a quality's enabled state
		await goToQualityProfileQualities(page, localId, profileName);
		const rows = page.locator('div.space-y-4 > div[role="button"]');
		await expect(rows.first()).toBeVisible();

		// Find a non-upgrade-until row to toggle
		const rowCount = await rows.count();
		let targetRow = rows.first();
		for (let i = 0; i < rowCount; i++) {
			const candidate = rows.nth(i);
			const upgradeUntilChecked =
				(await candidate.locator('[role="checkbox"]').first().getAttribute('aria-checked')) ===
				'true';
			if (!upgradeUntilChecked) {
				targetRow = candidate;
				break;
			}
		}

		targetQualityName = (await targetRow.locator('div.font-medium').first().innerText()).trim();
		originalEnabled =
			(await targetRow.locator('[role="checkbox"]').last().getAttribute('aria-checked')) === 'true';

		await targetRow.click();
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: rename the profile
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpName(page, devName);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.20 qp upstream rename + local qualities');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream name kept
		await goToQualityProfileGeneral(page, localId, devName);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(devName);

		// Verify: qualities reverted to original (user op dropped)
		await goToQualityProfileQualities(page, localId, devName);
		const finalRow = page
			.locator('div.space-y-4 > div[role="button"]')
			.filter({ has: page.locator('div.font-medium', { hasText: targetQualityName }) })
			.first();
		await expect(finalRow).toBeVisible();
		const finalEnabled =
			(await finalRow.locator('[role="checkbox"]').last().getAttribute('aria-checked')) === 'true';
		expect(finalEnabled).toBe(originalEnabled);
	});
});
