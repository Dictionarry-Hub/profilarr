/**
 * 1.23 Custom Format — regex dependency change (no conflict)
 *
 * Setup: Condition references a regex. User updates the condition.
 * Upstream changes the regex pattern (name unchanged).
 * Expected: No conflict. Condition update applies and regex pattern updates.
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, expectNoConflict } from '../helpers/conflicts';
import {
	goToCustomFormatConditions,
	addPatternCondition,
	setConditionRequiredByName,
	getConditionRequiredByName,
	saveConditionChanges,
	goToRegex,
	updateRegexPattern
} from '../helpers/entity';
import { fillMarkdownInput } from '../helpers/markdown';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';

const REGEX_PREFIX = 'E2E Regex Dep 1.23';
const REGEX_PATTERN_V1 = '\\bDEP123\\b';
const REGEX_PATTERN_V2 = '\\bDEP456\\b';
const CONDITION_PREFIX = 'E2E Regex Condition 1.23';

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

test.describe('1.23 CF regex dependency change', () => {
	test.describe.configure({ timeout: 180_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let regexName: string;
	let conditionName: string;

	test.beforeEach(async ({ browser }) => {
		const page = await browser.newPage();
		const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		regexName = `${REGEX_PREFIX} ${runId}`;
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

	test('no conflict when regex pattern changes', async ({ page }) => {
		// Dev creates regex and pushes
		await createRegex(page, devId, regexName, REGEX_PATTERN_V1);
		await exportAndPush(page, devId, 'e2e: 1.23 seed regex');

		// Local pulls regex
		await pullChanges(page, localId);

		// Dev adds a pattern condition referencing the regex
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await addPatternCondition(page, {
			name: conditionName,
			typeLabel: 'Release Title',
			patternLabel: regexName
		});
		await saveConditionChanges(page);
		await exportAndPush(page, devId, 'e2e: 1.23 seed condition');

		// Local pulls condition
		await pullChanges(page, localId);

		// Local updates the condition (toggle required)
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		await setConditionRequiredByName(page, conditionName, true);
		await saveConditionChanges(page);

		// Dev updates regex pattern
		await goToRegex(page, devId, regexName);
		await updateRegexPattern(page, REGEX_PATTERN_V2);
		await exportAndPush(page, devId, 'e2e: 1.23 regex change');

		// Local pulls → no conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectNoConflict(page, TEST_CF_NAME);

		// Verify local condition change persists
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		expect(await getConditionRequiredByName(page, conditionName)).toBe(true);

		// Verify regex pattern updated
		await goToRegex(page, localId, regexName);
		expect(await page.locator('#pattern').inputValue()).toBe(REGEX_PATTERN_V2);
	});
});
