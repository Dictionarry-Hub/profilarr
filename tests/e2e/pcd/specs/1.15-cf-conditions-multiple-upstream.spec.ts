/**
 * 1.15 Custom Format — multiple conditions changed upstream
 *
 * Setup:
 * - Upstream seeds two Source conditions.
 * - Local changes both (A + B) in one save.
 * - Upstream changes one overlapping condition (B) and a separate existing condition (C).
 *
 * Expected after per-condition ops:
 * - Conflict only for B.
 * - A (non-conflicting local change) should still apply.
 *
 * a) Override → A local, B local, C upstream
 * b) Align → A local, B upstream, C upstream
 */
import { test, expect, type Page } from '@playwright/test';
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
	addEnumCondition,
	updateConditionValueByName,
	getConditionValueByName,
	saveConditionChanges
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';

const CONDITION_A = 'E2E Cond A 1.15';
const CONDITION_B = 'E2E Cond B 1.15';
const CONDITION_C = 'Not 2160p';

const CONDITION_A_INITIAL = 'Bluray';
const CONDITION_B_INITIAL = 'WEB-DL';

const LOCAL_A_VALUE = 'DVD';
const LOCAL_B_VALUE = 'Television';

const DEV_B_VALUE = 'WEBRip';
const DEV_C_VALUE = '720p';

async function seedConditions(page: Page, devId: number, localId: number) {
	await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
	await addEnumCondition(page, {
		name: CONDITION_A,
		typeLabel: 'Source',
		valueLabel: CONDITION_A_INITIAL
	});
	await addEnumCondition(page, {
		name: CONDITION_B,
		typeLabel: 'Source',
		valueLabel: CONDITION_B_INITIAL
	});
	await saveConditionChanges(page);

	await exportAndPush(page, devId, 'e2e: 1.15 seed conditions');
	await pullChanges(page, localId);
}

test.describe('1.15 CF conditions multiple upstream changes', () => {
	test.describe.configure({ timeout: 120_000 });

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

	test('a) override — keep local A/B, upstream C', async ({ page }) => {
		await seedConditions(page, devId, localId);

		// Local edits A + B
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await updateConditionValueByName(page, CONDITION_A, LOCAL_A_VALUE);
		await updateConditionValueByName(page, CONDITION_B, LOCAL_B_VALUE);
		await saveConditionChanges(page);

		// Dev edits overlapping B + separate C
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await updateConditionValueByName(page, CONDITION_B, DEV_B_VALUE);
		await updateConditionValueByName(page, CONDITION_C, DEV_C_VALUE);
		await saveConditionChanges(page);

		await exportAndPush(page, devId, 'e2e: 1.15 multi-upstream conflict');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		await overrideConflict(page, TEST_CF_NAME);

		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		expect(await getConditionValueByName(page, CONDITION_A)).toBe(LOCAL_A_VALUE);
		expect(await getConditionValueByName(page, CONDITION_B)).toBe(LOCAL_B_VALUE);
		expect(await getConditionValueByName(page, CONDITION_C)).toBe(DEV_C_VALUE);
	});

	test('b) align — keep local A, upstream B/C', async ({ page }) => {
		await seedConditions(page, devId, localId);

		// Local edits A + B
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await updateConditionValueByName(page, CONDITION_A, LOCAL_A_VALUE);
		await updateConditionValueByName(page, CONDITION_B, LOCAL_B_VALUE);
		await saveConditionChanges(page);

		// Dev edits overlapping B + separate C
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await updateConditionValueByName(page, CONDITION_B, DEV_B_VALUE);
		await updateConditionValueByName(page, CONDITION_C, DEV_C_VALUE);
		await saveConditionChanges(page);

		await exportAndPush(page, devId, 'e2e: 1.15 multi-upstream conflict');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		await alignConflict(page, TEST_CF_NAME);

		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		expect(await getConditionValueByName(page, CONDITION_A)).toBe(LOCAL_A_VALUE);
		expect(await getConditionValueByName(page, CONDITION_B)).toBe(DEV_B_VALUE);
		expect(await getConditionValueByName(page, CONDITION_C)).toBe(DEV_C_VALUE);
	});
});
