/**
 * 3.4 Regular Expression — description conflict
 *
 * Local changes description on regex "3D". Dev changes description differently.
 * a) Override — local description wins
 * b) Align — dev description wins
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
const REGEX_NAME = '3D';
const LOCAL_DESC = 'Local description for 3.4';
const DEV_DESC = 'Dev description for 3.4';

async function updateDescription(
	page: import('@playwright/test').Page,
	desc: string
): Promise<void> {
	const textarea = page.locator('#description');
	await textarea.scrollIntoViewIfNeeded();
	await textarea.fill(desc);
	await page.getByRole('button', { name: 'Save Changes' }).click();
	await page.waitForLoadState('networkidle');
}

test.describe('3.4 Regex description conflict', () => {
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

	test('a) override — local description wins', async ({ page }) => {
		await goToRegex(page, localId, REGEX_NAME);
		await updateDescription(page, LOCAL_DESC);

		await goToRegex(page, devId, REGEX_NAME);
		await updateDescription(page, DEV_DESC);

		await exportAndPush(page, devId, 'e2e: 3.4 regex description conflict');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, REGEX_NAME);
		await overrideConflict(page, REGEX_NAME);

		await goToRegex(page, localId, REGEX_NAME);
		await expect(page.locator('#description')).toHaveValue(LOCAL_DESC);
	});

	test('b) align — dev description wins', async ({ page }) => {
		await goToRegex(page, localId, REGEX_NAME);
		await updateDescription(page, LOCAL_DESC);

		await goToRegex(page, devId, REGEX_NAME);
		await updateDescription(page, DEV_DESC);

		await exportAndPush(page, devId, 'e2e: 3.4 regex description conflict');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, REGEX_NAME);
		await alignConflict(page, REGEX_NAME);

		await goToRegex(page, localId, REGEX_NAME);
		await expect(page.locator('#description')).toHaveValue(DEV_DESC);
	});
});
