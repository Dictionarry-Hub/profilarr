/**
 * 1.25 Custom Format — local update while upstream deletes
 *
 * Setup: User updates CF general fields. Upstream deletes the CF.
 * Conflict: user UPDATE targets a row that no longer exists → rowcount 0.
 *
 * a) Override → CF re-created with user's values
 * b) Align → CF remains deleted
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
import { goToCustomFormat, goToCustomFormatGeneral, updateCfDescription } from '../helpers/entity';
import { fillMarkdownInput } from '../helpers/markdown';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const CF_NAME_PREFIX = 'E2E Update Deleted 1.25';
const SEED_DESCRIPTION = 'Seed description for 1.25';
const LOCAL_DESCRIPTION = 'Local update description 1.25';

async function createCustomFormat(
	page: import('@playwright/test').Page,
	databaseId: number,
	name: string,
	description: string
): Promise<void> {
	await page.goto(`/custom-formats/${databaseId}/new`);
	await page.waitForLoadState('networkidle');
	await page.locator('#name').fill(name);
	await fillMarkdownInput(page, 'description', description);
	await page.getByRole('button', { name: 'Create' }).click();
	await page.waitForURL(new RegExp(`/custom-formats/${databaseId}/\\d+/conditions`), {
		timeout: 15_000
	});
	await page.waitForLoadState('networkidle');
}

async function deleteCustomFormat(
	page: import('@playwright/test').Page,
	databaseId: number,
	name: string
): Promise<void> {
	await goToCustomFormat(page, databaseId, name);
	await page.getByRole('button', { name: 'Delete' }).first().click();
	await page.getByRole('button', { name: 'Delete' }).last().click();
	await page.waitForURL(new RegExp(`/custom-formats/${databaseId}$`), {
		timeout: 15_000
	});
	await page.waitForLoadState('networkidle');
}

async function expectCustomFormatMissing(
	page: import('@playwright/test').Page,
	databaseId: number,
	name: string
): Promise<void> {
	await page.goto(`/custom-formats/${databaseId}`);
	await page.waitForLoadState('networkidle');
	await page.getByPlaceholder(/search/i).fill(name);
	await page.waitForTimeout(500);
	await expect(page.locator('table tbody tr', { hasText: name })).toHaveCount(0);
}

test.describe('1.25 CF update upstream deleted', () => {
	let localId: number;
	let devId: number;
	let devHead: string;
	let testCfName: string;

	test.beforeEach(async ({ browser }) => {
		const page = await browser.newPage();
		const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		testCfName = `${CF_NAME_PREFIX} ${runId}`;

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

	test('a) override — CF re-created with user values', async ({ page }) => {
		// Dev creates CF and pushes
		await createCustomFormat(page, devId, testCfName, SEED_DESCRIPTION);
		await exportAndPush(page, devId, 'e2e: 1.25 seed CF');

		// Local pulls seed CF
		await pullChanges(page, localId);

		// Local updates description
		await goToCustomFormatGeneral(page, localId, testCfName);
		await updateCfDescription(page, LOCAL_DESCRIPTION);

		// Dev deletes CF
		await deleteCustomFormat(page, devId, testCfName);
		await exportAndPush(page, devId, 'e2e: 1.25 delete CF');

		// Local pulls → conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, testCfName);

		// Override
		await overrideConflict(page, testCfName);

		// Verify CF exists with user's description
		await goToCustomFormatGeneral(page, localId, testCfName);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(LOCAL_DESCRIPTION);
	});

	test('b) align — CF remains deleted', async ({ page }) => {
		// Dev creates CF and pushes
		await createCustomFormat(page, devId, testCfName, SEED_DESCRIPTION);
		await exportAndPush(page, devId, 'e2e: 1.25 seed CF');

		// Local pulls seed CF
		await pullChanges(page, localId);

		// Local updates description
		await goToCustomFormatGeneral(page, localId, testCfName);
		await updateCfDescription(page, LOCAL_DESCRIPTION);

		// Dev deletes CF
		await deleteCustomFormat(page, devId, testCfName);
		await exportAndPush(page, devId, 'e2e: 1.25 delete CF');

		// Local pulls → conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, testCfName);

		// Align
		await alignConflict(page, testCfName);

		// Verify CF remains deleted
		await expectCustomFormatMissing(page, localId, testCfName);
	});
});
