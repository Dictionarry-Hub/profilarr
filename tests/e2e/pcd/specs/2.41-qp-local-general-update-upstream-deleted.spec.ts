/**
 * 2.41 Quality Profile — local general update while upstream deletes profile
 *
 * Setup: Dev seeds QP, both sides pull. Local updates description.
 *        Upstream deletes the QP and pushes.
 * Conflict: guard_mismatch — local UPDATE targets a row that no longer exists.
 *
 * a) Override → profile re-created with local's general values
 * b) Align → profile stays deleted, local op dropped
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
import { goToQualityProfileGeneral, updateQpDescription } from '../helpers/entity';
import { fillMarkdownInput } from '../helpers/markdown';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const QP_NAME_PREFIX = 'E2E Update Deleted 2.41';
const SEED_DESCRIPTION = 'Seed description for 2.41';
const LOCAL_DESCRIPTION = 'Local update description 2.41';

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

async function deleteQualityProfile(
	page: import('@playwright/test').Page,
	databaseId: number,
	name: string
): Promise<void> {
	await goToQualityProfileGeneral(page, databaseId, name);
	await page.getByRole('button', { name: 'Delete' }).first().click();
	// Confirm in the modal
	await page.getByRole('button', { name: 'Delete' }).last().click();
	await page.waitForURL(new RegExp(`/quality-profiles/${databaseId}$`), {
		timeout: 15_000
	});
	await page.waitForLoadState('networkidle');
}

async function expectQualityProfileMissing(
	page: import('@playwright/test').Page,
	databaseId: number,
	name: string
): Promise<void> {
	await page.goto(`/quality-profiles/${databaseId}`);
	await page.waitForLoadState('networkidle');
	await page.getByPlaceholder(/search/i).fill(name);
	await page.waitForTimeout(500);
	await expect(page.locator('table tbody tr', { hasText: name })).toHaveCount(0);
}

test.describe('2.41 QP local general update while upstream deletes', () => {
	test.describe.configure({ timeout: 120_000 });

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

	test('a) override — profile re-created with local values', async ({ page }) => {
		// Dev creates QP and pushes
		await createQualityProfile(page, devId, testQpName, SEED_DESCRIPTION);
		await exportAndPush(page, devId, 'e2e: 2.41 seed QP');

		// Local pulls seed QP
		await pullChanges(page, localId);

		// Local updates description
		await goToQualityProfileGeneral(page, localId, testQpName);
		await updateQpDescription(page, LOCAL_DESCRIPTION);

		// Dev deletes QP and pushes
		await deleteQualityProfile(page, devId, testQpName);
		await exportAndPush(page, devId, 'e2e: 2.41 delete QP');

		// Local pulls → conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, testQpName);

		// Override
		await overrideConflict(page, testQpName);

		// Verify: profile exists with local's description
		await goToQualityProfileGeneral(page, localId, testQpName);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(LOCAL_DESCRIPTION);
	});

	test('b) align — profile stays deleted', async ({ page }) => {
		// Dev creates QP and pushes
		await createQualityProfile(page, devId, testQpName, SEED_DESCRIPTION);
		await exportAndPush(page, devId, 'e2e: 2.41 seed QP');

		// Local pulls seed QP
		await pullChanges(page, localId);

		// Local updates description
		await goToQualityProfileGeneral(page, localId, testQpName);
		await updateQpDescription(page, LOCAL_DESCRIPTION);

		// Dev deletes QP and pushes
		await deleteQualityProfile(page, devId, testQpName);
		await exportAndPush(page, devId, 'e2e: 2.41 delete QP');

		// Local pulls → conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, testQpName);

		// Align
		await alignConflict(page, testQpName);

		// Verify: profile stays deleted
		await expectQualityProfileMissing(page, localId, testQpName);
	});
});
