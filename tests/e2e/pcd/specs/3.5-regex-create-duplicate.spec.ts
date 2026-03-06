/**
 * 3.5 Regular Expression — create duplicate key conflict
 *
 * Local creates regex "E2E Duplicate". Dev also creates "E2E Duplicate" with
 * different pattern/description. Dev pushes, local pulls.
 * a) Override — local values win
 * b) Align — dev values win, local op dropped
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
const REGEX_NAME = 'E2E Duplicate';
const LOCAL_PATTERN = '\\bLOCAL_DUPE\\b';
const LOCAL_DESC = 'Local duplicate description';
const DEV_PATTERN = '\\bDEV_DUPE\\b';
const DEV_DESC = 'Dev duplicate description';

async function createRegex(
	page: import('@playwright/test').Page,
	databaseId: number,
	opts: { name: string; pattern: string; description: string }
): Promise<void> {
	await page.goto(`/regular-expressions/${databaseId}/new`);
	await page.waitForLoadState('networkidle');

	await page.locator('#name').fill(opts.name);
	await page.locator('#pattern').fill(opts.pattern);
	const textarea = page.locator('#description');
	await textarea.scrollIntoViewIfNeeded();
	await textarea.fill(opts.description);

	await page.getByRole('button', { name: 'Create' }).click();
	await page.waitForLoadState('networkidle');
}

test.describe('3.5 Regex create duplicate conflict', () => {
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

	test('a) override — local values win', async ({ page }) => {
		await createRegex(page, localId, {
			name: REGEX_NAME,
			pattern: LOCAL_PATTERN,
			description: LOCAL_DESC
		});

		await createRegex(page, devId, {
			name: REGEX_NAME,
			pattern: DEV_PATTERN,
			description: DEV_DESC
		});

		await exportAndPush(page, devId, 'e2e: 3.5 regex create duplicate');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, REGEX_NAME);
		await overrideConflict(page, REGEX_NAME);

		await goToRegex(page, localId, REGEX_NAME);
		const pattern = await page.locator('#pattern').inputValue();
		expect(pattern).toBe(LOCAL_PATTERN);
		const desc = await page.locator('#description').inputValue();
		expect(desc).toBe(LOCAL_DESC);
	});

	test('b) align — dev values win', async ({ page }) => {
		await createRegex(page, localId, {
			name: REGEX_NAME,
			pattern: LOCAL_PATTERN,
			description: LOCAL_DESC
		});

		await createRegex(page, devId, {
			name: REGEX_NAME,
			pattern: DEV_PATTERN,
			description: DEV_DESC
		});

		await exportAndPush(page, devId, 'e2e: 3.5 regex create duplicate');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, REGEX_NAME);
		await alignConflict(page, REGEX_NAME);

		await goToRegex(page, localId, REGEX_NAME);
		const pattern = await page.locator('#pattern').inputValue();
		expect(pattern).toBe(DEV_PATTERN);
		const desc = await page.locator('#description').inputValue();
		expect(desc).toBe(DEV_DESC);
	});
});
