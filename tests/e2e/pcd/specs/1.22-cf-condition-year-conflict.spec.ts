/**
 * 1.22 Custom Format — year condition conflict
 *
 * Setup: User changes year condition. Upstream changes the same condition to a different year.
 * Conflict: guard mismatch on year row.
 *
 * a) Override → year uses user's value
 * b) Align → year uses upstream value
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
	addYearCondition,
	setConditionYearByName,
	getConditionYearByName,
	saveConditionChanges
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';

const CONDITION_NAME = 'E2E Year Cond 1.22';
const BASE_MIN = 2000;
const LOCAL_MIN = 2001;
const DEV_MIN = 2002;

test.describe('1.22 CF condition year conflict', () => {
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

	test('a) override — year uses user value', async ({ page }) => {
		// Dev adds year condition
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await addYearCondition(page, { name: CONDITION_NAME, minYear: BASE_MIN });
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.22 seed year condition');

		// Local pulls condition
		await pullChanges(page, localId);

		// Local changes year
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await setConditionYearByName(page, CONDITION_NAME, { minYear: LOCAL_MIN });
		await saveConditionChanges(page);

		// Dev changes year differently
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await setConditionYearByName(page, CONDITION_NAME, { minYear: DEV_MIN });
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.22 year conflict');

		// Local pulls → conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		await overrideConflict(page, TEST_CF_NAME);

		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		const { minYear } = await getConditionYearByName(page, CONDITION_NAME);
		expect(minYear).toBe(LOCAL_MIN);
	});

	test('b) align — year uses upstream value', async ({ page }) => {
		// Dev adds year condition
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await addYearCondition(page, { name: CONDITION_NAME, minYear: BASE_MIN });
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.22 seed year condition');

		// Local pulls condition
		await pullChanges(page, localId);

		// Local changes year
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await setConditionYearByName(page, CONDITION_NAME, { minYear: LOCAL_MIN });
		await saveConditionChanges(page);

		// Dev changes year differently
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await setConditionYearByName(page, CONDITION_NAME, { minYear: DEV_MIN });
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.22 year conflict');

		// Local pulls → conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		await alignConflict(page, TEST_CF_NAME);

		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		const { minYear } = await getConditionYearByName(page, CONDITION_NAME);
		expect(minYear).toBe(DEV_MIN);
	});
});
