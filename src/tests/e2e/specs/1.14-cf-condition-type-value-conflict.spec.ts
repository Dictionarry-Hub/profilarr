/**
 * 1.14 Custom Format — condition type + value conflict
 *
 * Setup: User changes condition type + value on "Not 2160p".
 * Upstream changes the same condition to a different type + value.
 * Conflict: guard mismatch on the condition row.
 *
 * a) Override → condition uses user's type/value
 * b) Align → condition uses upstream type/value
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
	updateConditionTypeByName,
	updateConditionValueByName,
	getConditionTypeByName,
	getConditionValueByName,
	saveConditionChanges
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';
const CONDITION_NAME = 'Not 2160p';

const LOCAL_TYPE = 'Source';
const LOCAL_VALUE = 'Bluray';
const DEV_TYPE = 'Source';
const DEV_VALUE = 'WEB-DL';

test.describe('1.14 CF condition type + value conflict', () => {
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

	test('a) override — condition uses user type/value', async ({ page }) => {
		// Local edits condition type + value
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await updateConditionTypeByName(page, CONDITION_NAME, LOCAL_TYPE);
		await updateConditionValueByName(page, CONDITION_NAME, LOCAL_VALUE);
		await saveConditionChanges(page);

		// Dev edits same condition differently
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await updateConditionTypeByName(page, CONDITION_NAME, DEV_TYPE);
		await updateConditionValueByName(page, CONDITION_NAME, DEV_VALUE);
		await saveConditionChanges(page);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.14 condition type+value conflict');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		// Override
		await overrideConflict(page, TEST_CF_NAME);

		// Verify condition uses user's type/value
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		expect(await getConditionTypeByName(page, CONDITION_NAME)).toBe(LOCAL_TYPE);
		expect(await getConditionValueByName(page, CONDITION_NAME)).toBe(LOCAL_VALUE);
	});

	test('b) align — condition uses upstream type/value', async ({ page }) => {
		// Local edits condition type + value
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await updateConditionTypeByName(page, CONDITION_NAME, LOCAL_TYPE);
		await updateConditionValueByName(page, CONDITION_NAME, LOCAL_VALUE);
		await saveConditionChanges(page);

		// Dev edits same condition differently
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await updateConditionTypeByName(page, CONDITION_NAME, DEV_TYPE);
		await updateConditionValueByName(page, CONDITION_NAME, DEV_VALUE);
		await saveConditionChanges(page);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.14 condition type+value conflict');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		// Align
		await alignConflict(page, TEST_CF_NAME);

		// Verify condition uses upstream type/value
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		expect(await getConditionTypeByName(page, CONDITION_NAME)).toBe(DEV_TYPE);
		expect(await getConditionValueByName(page, CONDITION_NAME)).toBe(DEV_VALUE);
	});
});
