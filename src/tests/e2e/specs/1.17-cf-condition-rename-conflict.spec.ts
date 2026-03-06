/**
 * 1.17 Custom Format — condition rename conflict
 *
 * Setup: User renames a condition. Upstream changes a base field (required).
 * Conflict: delete guard mismatch on base row.
 *
 * a) Override → condition renamed, required stays at original value
 * b) Align → condition keeps original name, required uses upstream value
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
	updateConditionNameByName,
	getConditionRequiredByName,
	setConditionRequiredByName,
	hasConditionByName,
	saveConditionChanges
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';
const CONDITION_NAME = 'Not 2160p';
const RENAMED_CONDITION = 'Not 2160p Renamed';

test.describe('1.17 CF condition rename conflict', () => {
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

	test('a) override — renamed condition, original required', async ({ page }) => {
		// Capture initial required value
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		const initialRequired = await getConditionRequiredByName(page, CONDITION_NAME);

		// Local renames condition
		await updateConditionNameByName(page, CONDITION_NAME, RENAMED_CONDITION);
		await saveConditionChanges(page);

		// Dev changes required
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await setConditionRequiredByName(page, CONDITION_NAME, !initialRequired);
		await saveConditionChanges(page);

		await exportAndPush(page, devId, 'e2e: 1.17 condition rename conflict');

		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		await overrideConflict(page, TEST_CF_NAME);

		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		expect(await hasConditionByName(page, RENAMED_CONDITION)).toBe(true);
		expect(await hasConditionByName(page, CONDITION_NAME)).toBe(false);
		expect(await getConditionRequiredByName(page, RENAMED_CONDITION)).toBe(initialRequired);
	});

	test('b) align — original condition, upstream required', async ({ page }) => {
		// Capture initial required value
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		const initialRequired = await getConditionRequiredByName(page, CONDITION_NAME);

		// Local renames condition
		await updateConditionNameByName(page, CONDITION_NAME, RENAMED_CONDITION);
		await saveConditionChanges(page);

		// Dev changes required
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await setConditionRequiredByName(page, CONDITION_NAME, !initialRequired);
		await saveConditionChanges(page);

		await exportAndPush(page, devId, 'e2e: 1.17 condition rename conflict');

		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		await alignConflict(page, TEST_CF_NAME);

		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		expect(await hasConditionByName(page, CONDITION_NAME)).toBe(true);
		expect(await hasConditionByName(page, RENAMED_CONDITION)).toBe(false);
		expect(await getConditionRequiredByName(page, CONDITION_NAME)).toBe(!initialRequired);
	});
});
