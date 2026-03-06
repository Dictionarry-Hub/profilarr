/**
 * 1.21 Custom Format — size condition conflict
 *
 * Setup: User changes size condition. Upstream changes the same condition to a different size.
 * Conflict: guard mismatch on size row.
 *
 * a) Override → size uses user's value
 * b) Align → size uses upstream value
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
	addSizeCondition,
	setConditionSizeByName,
	getConditionSizeByName,
	saveConditionChanges
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';

const CONDITION_PREFIX = 'E2E Size Cond 1.21';
const BASE_MIN = 1;
const LOCAL_MIN = 2;
const DEV_MIN = 3;

test.describe('1.21 CF condition size conflict', () => {
	let localId: number;
	let devId: number;
	let devHead: string;
	let conditionName: string;

	test.beforeEach(async ({ browser }) => {
		const page = await browser.newPage();
		const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		conditionName = `${CONDITION_PREFIX} ${runId}`;

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

	test('a) override — size uses user value', async ({ page }) => {
		// Dev adds size condition
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await addSizeCondition(page, { name: conditionName, minGB: BASE_MIN });
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.21 seed size condition');

		// Local pulls condition
		await pullChanges(page, localId);

		// Local changes size
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await setConditionSizeByName(page, conditionName, { minGB: LOCAL_MIN });
		await saveConditionChanges(page);

		// Dev changes size differently
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await setConditionSizeByName(page, conditionName, { minGB: DEV_MIN });
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.21 size conflict');

		// Local pulls → conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		await overrideConflict(page, TEST_CF_NAME);

		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		const { minGB } = await getConditionSizeByName(page, conditionName);
		expect(minGB).toBe(LOCAL_MIN);
	});

	test('b) align — size uses upstream value', async ({ page }) => {
		// Dev adds size condition
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await addSizeCondition(page, { name: conditionName, minGB: BASE_MIN });
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.21 seed size condition');

		// Local pulls condition
		await pullChanges(page, localId);

		// Local changes size
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await setConditionSizeByName(page, conditionName, { minGB: LOCAL_MIN });
		await saveConditionChanges(page);

		// Dev changes size differently
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await setConditionSizeByName(page, conditionName, { minGB: DEV_MIN });
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.21 size conflict');

		// Local pulls → conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		await alignConflict(page, TEST_CF_NAME);

		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		const { minGB } = await getConditionSizeByName(page, conditionName);
		expect(minGB).toBe(DEV_MIN);
	});
});
