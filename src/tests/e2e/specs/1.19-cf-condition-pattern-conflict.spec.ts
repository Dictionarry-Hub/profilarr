/**
 * 1.19 Custom Format — pattern condition conflict
 *
 * Setup: User changes a pattern condition. Upstream changes the same condition to a different pattern.
 * Conflict: guard mismatch on pattern row.
 *
 * a) Override → pattern uses user's regex
 * b) Align → pattern uses upstream regex
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
	addPatternCondition,
	updateConditionPatternByName,
	getConditionPatternByName,
	saveConditionChanges
} from '../helpers/entity';
import { fillMarkdownInput } from '../helpers/markdown';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';

const REGEX_A_PREFIX = 'E2E Pattern A 1.19';
const REGEX_B_PREFIX = 'E2E Pattern B 1.19';
const REGEX_C_PREFIX = 'E2E Pattern C 1.19';
const CONDITION_PREFIX = 'E2E Pattern Cond 1.19';

async function createRegex(
	page: import('@playwright/test').Page,
	databaseId: number,
	name: string,
	pattern: string
): Promise<void> {
	await page.goto(`/regular-expressions/${databaseId}/new`);
	await page.waitForLoadState('networkidle');
	await page.locator('#name').fill(name);
	await page.locator('#pattern').fill(pattern);
	await fillMarkdownInput(page, 'description', `Pattern for ${name}`);
	await page.getByRole('button', { name: 'Create' }).click();
	await page.waitForURL(/\/regular-expressions\/\d+/, {
		timeout: 15_000
	});
	await page.waitForLoadState('networkidle');
}

test.describe('1.19 CF condition pattern conflict', () => {
	test.describe.configure({ timeout: 180_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let regexA: string;
	let regexB: string;
	let regexC: string;
	let conditionName: string;

	test.beforeEach(async ({ browser }) => {
		const page = await browser.newPage();
		const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		regexA = `${REGEX_A_PREFIX} ${runId}`;
		regexB = `${REGEX_B_PREFIX} ${runId}`;
		regexC = `${REGEX_C_PREFIX} ${runId}`;
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

	test('a) override — pattern uses user regex', async ({ page }) => {
		// Dev creates regex patterns and pushes
		await createRegex(page, devId, regexA, '\\bTESTA\\b');
		await createRegex(page, devId, regexB, '\\bTESTB\\b');
		await createRegex(page, devId, regexC, '\\bTESTC\\b');
		await exportAndPush(page, devId, 'e2e: 1.19 seed regex');

		// Local pulls regex patterns
		await pullChanges(page, localId);

		// Dev adds pattern condition using REGEX_A
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await addPatternCondition(page, {
			name: conditionName,
			typeLabel: 'Release Title',
			patternLabel: regexA
		});
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.19 seed condition');

		// Local pulls condition
		await pullChanges(page, localId);

		// Local changes pattern to REGEX_B
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await updateConditionPatternByName(page, conditionName, regexB);
		await saveConditionChanges(page);

		// Dev changes pattern to REGEX_C
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await updateConditionPatternByName(page, conditionName, regexC);
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.19 pattern conflict');

		// Local pulls → conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		await overrideConflict(page, TEST_CF_NAME);

		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		expect(await getConditionPatternByName(page, conditionName)).toBe(regexB);
	});

	test('b) align — pattern uses upstream regex', async ({ page }) => {
		// Dev creates regex patterns and pushes
		await createRegex(page, devId, regexA, '\\bTESTA\\b');
		await createRegex(page, devId, regexB, '\\bTESTB\\b');
		await createRegex(page, devId, regexC, '\\bTESTC\\b');
		await exportAndPush(page, devId, 'e2e: 1.19 seed regex');

		// Local pulls regex patterns
		await pullChanges(page, localId);

		// Dev adds pattern condition using REGEX_A
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await addPatternCondition(page, {
			name: conditionName,
			typeLabel: 'Release Title',
			patternLabel: regexA
		});
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.19 seed condition');

		// Local pulls condition
		await pullChanges(page, localId);

		// Local changes pattern to REGEX_B
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await updateConditionPatternByName(page, conditionName, regexB);
		await saveConditionChanges(page);

		// Dev changes pattern to REGEX_C
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await updateConditionPatternByName(page, conditionName, regexC);
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.19 pattern conflict');

		// Local pulls → conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		await alignConflict(page, TEST_CF_NAME);

		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		expect(await getConditionPatternByName(page, conditionName)).toBe(regexC);
	});
});
