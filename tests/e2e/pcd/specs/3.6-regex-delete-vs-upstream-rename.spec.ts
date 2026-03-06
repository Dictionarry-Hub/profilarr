/**
 * 3.6 Regular Expression — delete vs upstream rename (auto-align)
 *
 * Local deletes regex "3L". Dev renames "3L" to something new.
 * Expected: Auto-align — local delete's name guard fails (rowcount 0),
 * op is auto-dropped. No conflict appears. Regex persists with dev's name.
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, expectNoConflict } from '../helpers/conflicts';
import { goToRegex } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const REGEX_NAME = '3L';
const DEV_NAME = '3L Dev Rename';

async function renameRegex(page: import('@playwright/test').Page, newName: string): Promise<void> {
	await page.locator('#name').fill(newName);
	await page.getByRole('button', { name: 'Save Changes' }).click();
	await page.waitForLoadState('networkidle');
}

async function deleteRegex(
	page: import('@playwright/test').Page,
	databaseId: number,
	name: string
): Promise<void> {
	await goToRegex(page, databaseId, name);
	await page.getByRole('button', { name: 'Delete' }).first().click();
	await page.getByRole('button', { name: 'Delete' }).last().click();
	await page.waitForURL(new RegExp(`/regular-expressions/${databaseId}$`), {
		timeout: 15_000
	});
	await page.waitForLoadState('networkidle');
}

test.describe('3.6 Regex delete vs upstream rename', () => {
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

	test('a) auto-align — no conflict, regex persists with dev name', async ({ page }) => {
		// Local deletes the regex
		await deleteRegex(page, localId, REGEX_NAME);

		// Dev renames the regex
		await goToRegex(page, devId, REGEX_NAME);
		await renameRegex(page, DEV_NAME);

		await exportAndPush(page, devId, 'e2e: 3.6 rename');
		await pullChanges(page, localId);

		// No conflict expected
		await goToConflicts(page, localId);
		await expectNoConflict(page, REGEX_NAME);

		// Regex persists with dev's name
		await goToRegex(page, localId, DEV_NAME);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(DEV_NAME);
	});
});
