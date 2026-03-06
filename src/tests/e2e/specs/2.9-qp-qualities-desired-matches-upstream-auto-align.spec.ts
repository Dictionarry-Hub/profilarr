/**
 * 2.9 Quality Profile — local qualities desired already matches upstream
 *
 * Setup: Local toggles a quality row enabled state.
 * Upstream sets that same quality row to the same desired state.
 * Expected: Auto-align (no conflict). Local op is dropped.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, getConflictCount } from '../helpers/conflicts';
import { openFirstQualityProfileGeneral, goToQualityProfileQualities } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';

async function getQualityRows(page: Page): Promise<Locator> {
	return page.locator('div.space-y-4 > div[role="button"]');
}

async function getRowEnabledValue(row: Locator): Promise<boolean> {
	return (await row.locator('[role="checkbox"]').last().getAttribute('aria-checked')) === 'true';
}

async function getRowName(row: Locator): Promise<string> {
	return (await row.locator('div.font-medium').first().innerText()).trim();
}

async function isGroupRow(row: Locator): Promise<boolean> {
	return (await row.getByTitle('Edit group').count()) > 0;
}

async function findRowByName(page: Page, qualityName: string): Promise<Locator> {
	const escaped = qualityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return page
		.locator('div.space-y-4 > div[role="button"]')
		.filter({ has: page.locator('div.font-medium', { hasText: new RegExp(`^${escaped}$`) }) })
		.first();
}

test.describe('2.9 QP local qualities desired already matches upstream', () => {
	test.describe.configure({ timeout: 120_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let profileName: string;
	let targetQualityName: string;
	let desiredEnabledValue: boolean;

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

	test('auto-align', async ({ page }) => {
		// Seed upstream once so both sides have the same expanded qualities baseline.
		await goToQualityProfileQualities(page, devId, profileName);
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');
		await exportAndPush(page, devId, 'e2e: 2.9 qp qualities baseline seed');
		await pullChanges(page, localId);

		// Local: toggle one non-group, non-upgrade-until quality row enabled state.
		await goToQualityProfileQualities(page, localId, profileName);
		const localRows = await getQualityRows(page);
		await expect(localRows.first()).toBeVisible();

		const rowCount = await localRows.count();
		let targetRow: Locator | null = null;
		for (let i = 0; i < rowCount; i++) {
			const candidate = localRows.nth(i);
			if (await isGroupRow(candidate)) continue;
			const upgradeUntilChecked =
				(await candidate.locator('[role="checkbox"]').first().getAttribute('aria-checked')) ===
				'true';
			if (!upgradeUntilChecked) {
				targetRow = candidate;
				break;
			}
		}
		if (!targetRow) {
			throw new Error('Could not find a non-group, non-upgrade-until quality row for 2.9');
		}

		targetQualityName = await getRowName(targetRow);
		const initialEnabledValue = await getRowEnabledValue(targetRow);
		desiredEnabledValue = !initialEnabledValue;

		await targetRow.locator('[role="checkbox"]').last().click();
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Dev: set the same row to the same desired enabled value.
		await goToQualityProfileQualities(page, devId, profileName);
		const devRow = await findRowByName(page, targetQualityName);
		await expect(devRow).toBeVisible();
		const devInitialEnabledValue = await getRowEnabledValue(devRow);
		if (devInitialEnabledValue !== desiredEnabledValue) {
			await devRow.locator('[role="checkbox"]').last().click();
		}
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		// Push upstream then pull local.
		await exportAndPush(page, devId, 'e2e: 2.9 qp qualities desired matches upstream auto-align');
		await pullChanges(page, localId);

		// Auto-align: no conflict remains.
		await goToConflicts(page, localId);
		const conflictCount = await getConflictCount(page);
		expect(conflictCount).toBe(0);

		// Local op should be dropped (no unpublished changes).
		await page.goto(`/databases/${localId}/changes`);
		await page.waitForLoadState('networkidle');
		await expect(page.getByText('No unpublished changes')).toBeVisible({ timeout: 15_000 });

		// Final qualities state is still the shared desired value.
		await goToQualityProfileQualities(page, localId, profileName);
		const finalRow = await findRowByName(page, targetQualityName);
		await expect(finalRow).toBeVisible();
		const finalEnabledValue = await getRowEnabledValue(finalRow);
		expect(finalEnabledValue).toBe(desiredEnabledValue);
	});
});
