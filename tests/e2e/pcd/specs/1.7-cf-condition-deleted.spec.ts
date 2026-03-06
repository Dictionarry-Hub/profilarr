/**
 * 1.7 Custom Format — upstream deletes condition user modified
 *
 * Setup: User modifies condition "Not 2160p". Upstream deletes it.
 * Conflict: user UPDATE targets a row that no longer exists → rowcount 0.
 *
 * a) Override → condition is re-created with user's desired values
 * b) Align → condition remains deleted
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
import {
	goToCustomFormatConditions,
	updateConditionValueByName,
	getConditionValueByName,
	saveConditionChanges,
	removeConditionByName,
	hasConditionByName
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';
const CONDITION_NAME = 'Not 2160p';
const LOCAL_RESOLUTION = '1080p';

test.describe('1.7 CF condition deleted conflict', () => {
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

	test('a) override — condition re-created with user value', async ({ page }) => {
		// Local modifies condition
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await updateConditionValueByName(page, CONDITION_NAME, LOCAL_RESOLUTION);
		await saveConditionChanges(page);

		// Dev deletes the condition
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await removeConditionByName(page, CONDITION_NAME);
		await saveConditionChanges(page);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.7 condition deleted');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		// Override
		await overrideConflict(page, TEST_CF_NAME);

		// Verify condition is re-created with user's value
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		const value = await getConditionValueByName(page, CONDITION_NAME);
		expect(value).toBe(LOCAL_RESOLUTION);
	});

	test('b) align — condition remains deleted', async ({ page }) => {
		// Local modifies condition
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await updateConditionValueByName(page, CONDITION_NAME, LOCAL_RESOLUTION);
		await saveConditionChanges(page);

		// Dev deletes the condition
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await removeConditionByName(page, CONDITION_NAME);
		await saveConditionChanges(page);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.7 condition deleted');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		// Align
		await alignConflict(page, TEST_CF_NAME);

		// Verify condition remains deleted
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		const exists = await hasConditionByName(page, CONDITION_NAME);
		expect(exists).toBe(false);
	});
});
