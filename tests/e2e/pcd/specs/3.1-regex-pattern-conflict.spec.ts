/**
 * 3.1 Regular Expression — pattern change conflict
 *
 * Local changes regex pattern. Dev changes the same regex pattern differently.
 * a) Override — local pattern wins
 * b) Align — dev pattern wins
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
const REGEX_NAME = '126811';
const LOCAL_PATTERN = '\\bLOCAL_3_1\\b';
const DEV_PATTERN = '\\bDEV_3_1\\b';

test.describe('3.1 Regex pattern change conflict', () => {
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

	test('a) override — local pattern wins', async ({ page }) => {
		await goToRegex(page, localId, REGEX_NAME);
		await updateRegexPattern(page, LOCAL_PATTERN);

		await goToRegex(page, devId, REGEX_NAME);
		await updateRegexPattern(page, DEV_PATTERN);

		await exportAndPush(page, devId, 'e2e: 3.1 regex pattern conflict');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, REGEX_NAME);
		await overrideConflict(page, REGEX_NAME);

		await goToRegex(page, localId, REGEX_NAME);
		const pattern = await page.locator('#pattern').inputValue();
		expect(pattern).toBe(LOCAL_PATTERN);
	});

	test('b) align — dev pattern wins', async ({ page }) => {
		await goToRegex(page, localId, REGEX_NAME);
		await updateRegexPattern(page, LOCAL_PATTERN);

		await goToRegex(page, devId, REGEX_NAME);
		await updateRegexPattern(page, DEV_PATTERN);

		await exportAndPush(page, devId, 'e2e: 3.1 regex pattern conflict');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, REGEX_NAME);
		await alignConflict(page, REGEX_NAME);

		await goToRegex(page, localId, REGEX_NAME);
		const pattern = await page.locator('#pattern').inputValue();
		expect(pattern).toBe(DEV_PATTERN);
	});
});
