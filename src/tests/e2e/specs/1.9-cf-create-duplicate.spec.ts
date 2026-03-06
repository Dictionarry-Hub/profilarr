/**
 * 1.9 Custom Format — create conflict (duplicate key)
 *
 * Setup: User creates CF "E2E Duplicate CF". Upstream also creates same name.
 * Conflict: UNIQUE constraint on name.
 *
 * a) Override → CF has user's desired values
 * b) Align → CF has upstream's values, user op dropped
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
import { goToCustomFormat } from '../helpers/entity';
import { fillMarkdownInput } from '../helpers/markdown';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'E2E Duplicate CF';
const LOCAL_DESCRIPTION = 'Local create description';
const DEV_DESCRIPTION = 'Upstream create description';

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

test.describe('1.9 CF create duplicate conflict', () => {
	let localId: number;
	let devId: number;
	let devHead: string;

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

	test('a) override — CF has user values', async ({ page }) => {
		// Local creates CF
		await createCustomFormat(page, localId, TEST_CF_NAME, LOCAL_DESCRIPTION);

		// Dev creates CF with same name but different description
		await createCustomFormat(page, devId, TEST_CF_NAME, DEV_DESCRIPTION);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.9 create duplicate');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		// Override
		await overrideConflict(page, TEST_CF_NAME);

		// Verify CF has user's description
		await goToCustomFormat(page, localId, TEST_CF_NAME);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(LOCAL_DESCRIPTION);
	});

	test('b) align — CF keeps upstream values', async ({ page }) => {
		// Local creates CF
		await createCustomFormat(page, localId, TEST_CF_NAME, LOCAL_DESCRIPTION);

		// Dev creates CF with same name but different description
		await createCustomFormat(page, devId, TEST_CF_NAME, DEV_DESCRIPTION);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.9 create duplicate');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		// Align
		await alignConflict(page, TEST_CF_NAME);

		// Verify CF has upstream description
		await goToCustomFormat(page, localId, TEST_CF_NAME);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(DEV_DESCRIPTION);
	});
});
