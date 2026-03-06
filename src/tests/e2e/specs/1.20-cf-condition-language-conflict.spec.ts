/**
 * 1.20 Custom Format — language condition conflict
 *
 * Setup: User changes a language condition. Upstream changes the same condition to a different language.
 * Conflict: guard mismatch on language row.
 *
 * a) Override → language uses user's value
 * b) Align → language uses upstream value
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
	addLanguageCondition,
	updateConditionLanguageByName,
	getConditionLanguageByName,
	saveConditionChanges
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';

const CONDITION_NAME = 'E2E Language Cond 1.20';
const BASE_LANGUAGE = 'English';
const LOCAL_LANGUAGE = 'French';
const DEV_LANGUAGE = 'Spanish';

test.describe('1.20 CF condition language conflict', () => {
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

	test('a) override — language uses user value', async ({ page }) => {
		// Dev adds language condition
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await addLanguageCondition(page, {
			name: CONDITION_NAME,
			languageLabel: BASE_LANGUAGE
		});
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.20 seed language condition');

		// Local pulls condition
		await pullChanges(page, localId);

		// Local changes language
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await updateConditionLanguageByName(page, CONDITION_NAME, LOCAL_LANGUAGE);
		await saveConditionChanges(page);

		// Dev changes language differently
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await updateConditionLanguageByName(page, CONDITION_NAME, DEV_LANGUAGE);
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.20 language conflict');

		// Local pulls → conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		await overrideConflict(page, TEST_CF_NAME);

		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		expect(await getConditionLanguageByName(page, CONDITION_NAME)).toBe(LOCAL_LANGUAGE);
	});

	test('b) align — language uses upstream value', async ({ page }) => {
		// Dev adds language condition
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await addLanguageCondition(page, {
			name: CONDITION_NAME,
			languageLabel: BASE_LANGUAGE
		});
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.20 seed language condition');

		// Local pulls condition
		await pullChanges(page, localId);

		// Local changes language
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await updateConditionLanguageByName(page, CONDITION_NAME, LOCAL_LANGUAGE);
		await saveConditionChanges(page);

		// Dev changes language differently
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await updateConditionLanguageByName(page, CONDITION_NAME, DEV_LANGUAGE);
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.20 language conflict');

		// Local pulls → conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		await alignConflict(page, TEST_CF_NAME);

		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		expect(await getConditionLanguageByName(page, CONDITION_NAME)).toBe(DEV_LANGUAGE);
	});
});
