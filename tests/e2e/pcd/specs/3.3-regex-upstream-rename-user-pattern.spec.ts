/**
 * 3.3 Regular Expression — upstream rename + user pattern change
 *
 * Local changes the pattern on regex "3D". Dev renames "3D".
 * a) Override — dev name kept, local pattern wins
 * b) Align — dev name + dev pattern, local op dropped
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
import { goToRegex, updateRegexPattern } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const REGEX_NAME = '3D';
const DEV_NAME = '3D Dev Rename';
const LOCAL_PATTERN = '\\bLOCAL_3_3\\b';

async function renameRegex(page: import('@playwright/test').Page, newName: string): Promise<void> {
	await page.locator('#name').fill(newName);
	await page.getByRole('button', { name: 'Save Changes' }).click();
	await page.waitForLoadState('networkidle');
}

test.describe('3.3 Upstream rename + user pattern change', () => {
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

	test('a) override — local pattern wins, dev name kept', async ({ page }) => {
		// Local changes pattern
		await goToRegex(page, localId, REGEX_NAME);
		await updateRegexPattern(page, LOCAL_PATTERN);

		// Dev renames the regex
		await goToRegex(page, devId, REGEX_NAME);
		await renameRegex(page, DEV_NAME);

		await exportAndPush(page, devId, 'e2e: 3.3 upstream rename + user pattern');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, REGEX_NAME);
		await overrideConflict(page, REGEX_NAME);

		// After override: dev's name is kept (rename chain), local pattern wins
		await goToRegex(page, localId, DEV_NAME);
		const pattern = await page.locator('#pattern').inputValue();
		expect(pattern).toBe(LOCAL_PATTERN);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(DEV_NAME);
	});

	test('b) align — dev name + dev pattern, local op dropped', async ({ page }) => {
		// Local changes pattern
		await goToRegex(page, localId, REGEX_NAME);
		const originalPattern = await page.locator('#pattern').inputValue();
		await updateRegexPattern(page, LOCAL_PATTERN);

		// Dev renames the regex
		await goToRegex(page, devId, REGEX_NAME);
		await renameRegex(page, DEV_NAME);

		await exportAndPush(page, devId, 'e2e: 3.3 upstream rename + user pattern');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, REGEX_NAME);
		await alignConflict(page, REGEX_NAME);

		// After align: dev name + original pattern (local change dropped)
		await goToRegex(page, localId, DEV_NAME);
		const pattern = await page.locator('#pattern').inputValue();
		expect(pattern).toBe(originalPattern);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(DEV_NAME);
	});
});
