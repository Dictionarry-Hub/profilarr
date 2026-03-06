/**
 * 1.6 Custom Format — upstream adds new condition, user modifies existing
 *
 * Setup: User modifies an existing condition. Upstream adds a new condition.
 * Expected: No conflict; user's change remains, new condition is present.
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, getConflictCount } from '../helpers/conflicts';
import {
	addEnumCondition,
	goToCustomFormatConditions,
	updateConditionValueByName,
	getConditionValueByName,
	saveConditionChanges
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';
const EXISTING_CONDITION = 'Not 2160p';
const LOCAL_RESOLUTION = '1080p';
const NEW_CONDITION_NAME = 'E2E Added Resolution';
const NEW_CONDITION_VALUE = '720p';

test.describe('1.6 CF condition no-conflict', () => {
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

	test('no conflict when upstream adds new condition', async ({ page }) => {
		// Local modifies existing condition
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await updateConditionValueByName(page, EXISTING_CONDITION, LOCAL_RESOLUTION);
		await saveConditionChanges(page);

		// Dev adds a new condition
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await addEnumCondition(page, {
			name: NEW_CONDITION_NAME,
			typeLabel: 'Resolution',
			valueLabel: NEW_CONDITION_VALUE
		});
		await saveConditionChanges(page);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.6 condition no-conflict');

		// Local pulls → no conflict expected
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		const conflictCount = await getConflictCount(page);
		expect(conflictCount).toBe(0);

		// Verify user's change remains
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		const value = await getConditionValueByName(page, EXISTING_CONDITION);
		expect(value).toBe(LOCAL_RESOLUTION);

		// Verify new condition exists with upstream value
		const newValue = await getConditionValueByName(page, NEW_CONDITION_NAME);
		expect(newValue).toBe(NEW_CONDITION_VALUE);
	});
});
