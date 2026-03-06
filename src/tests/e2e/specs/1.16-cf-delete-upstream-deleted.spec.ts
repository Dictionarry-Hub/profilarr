/**
 * 1.16 Custom Format — delete with upstream already deleted
 *
 * Setup: User deletes CF. Upstream deletes the same CF.
 * Expected: Auto-align (no conflict). User delete hits 0 rows.
 */
import { test } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, expectNoConflict } from '../helpers/conflicts';
import { goToCustomFormat } from '../helpers/entity';
import { fillMarkdownInput } from '../helpers/markdown';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const SEED_CF_NAME = 'E2E Delete Both';

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

test.describe('1.16 CF delete upstream deleted', () => {
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

	test('auto-align — delete op dropped (no conflict)', async ({ page }) => {
		// Dev creates CF and pushes
		await createCustomFormat(page, devId, SEED_CF_NAME, 'Seed description');
		await exportAndPush(page, devId, 'e2e: 1.16 seed CF');

		// Local pulls seed CF
		await pullChanges(page, localId);

		// Local deletes CF
		await deleteCustomFormat(page, localId, SEED_CF_NAME);

		// Dev deletes CF as well
		await deleteCustomFormat(page, devId, SEED_CF_NAME);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.16 delete CF');

		// Local pulls → auto-align (no conflict)
		await pullChanges(page, localId);

		// Verify no conflict exists
		await goToConflicts(page, localId);
		await expectNoConflict(page, SEED_CF_NAME);
	});
});
