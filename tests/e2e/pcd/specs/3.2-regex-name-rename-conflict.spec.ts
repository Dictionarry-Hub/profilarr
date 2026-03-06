/**
 * 3.2 Regular Expression — name rename conflict
 *
 * Local renames regex. Dev renames the same regex differently.
 * a) Override — local name wins
 * b) Align — dev name wins
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
import { goToRegex } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const REGEX_NAME = '126811';
const LOCAL_NAME = '126811 Local Rename';
const DEV_NAME = '126811 Dev Rename';

async function renameRegex(page: import('@playwright/test').Page, newName: string): Promise<void> {
	await page.locator('#name').fill(newName);
	await page.getByRole('button', { name: 'Save Changes' }).click();
	await page.waitForLoadState('networkidle');
}

test.describe('3.2 Regex name rename conflict', () => {
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

	test('a) override — local name wins', async ({ page }) => {
		await goToRegex(page, localId, REGEX_NAME);
		await renameRegex(page, LOCAL_NAME);

		await goToRegex(page, devId, REGEX_NAME);
		await renameRegex(page, DEV_NAME);

		await exportAndPush(page, devId, 'e2e: 3.2 regex name rename');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, REGEX_NAME);
		await overrideConflict(page, REGEX_NAME);

		await goToRegex(page, localId, LOCAL_NAME);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(LOCAL_NAME);
	});

	test('b) align — dev name wins', async ({ page }) => {
		await goToRegex(page, localId, REGEX_NAME);
		await renameRegex(page, LOCAL_NAME);

		await goToRegex(page, devId, REGEX_NAME);
		await renameRegex(page, DEV_NAME);

		await exportAndPush(page, devId, 'e2e: 3.2 regex name rename');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, REGEX_NAME);
		await alignConflict(page, REGEX_NAME);

		await goToRegex(page, localId, DEV_NAME);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(DEV_NAME);
	});
});
