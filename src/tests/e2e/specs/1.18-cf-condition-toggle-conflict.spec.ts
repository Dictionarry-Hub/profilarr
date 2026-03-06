/**
 * 1.18 Custom Format — condition toggle conflict (required/negate/arrType)
 *
 * Setup: User changes required + arrType. Upstream changes negate.
 * Conflict: base row guard mismatch.
 *
 * a) Override → local required/arrType, original negate
 * b) Align → upstream negate, original required/arrType
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
	getConditionRequiredByName,
	getConditionNegateByName,
	getConditionArrTypeByName,
	setConditionRequiredByName,
	setConditionArrTypeByName,
	setConditionNegateByName,
	saveConditionChanges
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';
const CONDITION_NAME = 'Not 2160p';
const VIEWPORT = { width: 1920, height: 1200 };

test.describe('1.18 CF condition toggle conflict', () => {
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

	test('a) override — local required/arrType, original negate', async ({ page }) => {
		await page.setViewportSize(VIEWPORT);
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		const initialRequired = await getConditionRequiredByName(page, CONDITION_NAME);
		const initialNegate = await getConditionNegateByName(page, CONDITION_NAME);
		const initialArrType = await getConditionArrTypeByName(page, CONDITION_NAME);
		const localArrType = initialArrType === 'radarr' ? 'sonarr' : 'radarr';

		// Local changes required + arrType
		await setConditionRequiredByName(page, CONDITION_NAME, !initialRequired);
		await setConditionArrTypeByName(page, CONDITION_NAME, localArrType);
		await saveConditionChanges(page);

		// Dev changes negate
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await setConditionNegateByName(page, CONDITION_NAME, !initialNegate);
		await saveConditionChanges(page);

		await exportAndPush(page, devId, 'e2e: 1.18 condition toggle conflict');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		await overrideConflict(page, TEST_CF_NAME);

		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		expect(await getConditionRequiredByName(page, CONDITION_NAME)).toBe(!initialRequired);
		expect(await getConditionArrTypeByName(page, CONDITION_NAME)).toBe(localArrType);
		expect(await getConditionNegateByName(page, CONDITION_NAME)).toBe(initialNegate);
	});

	test('b) align — upstream negate, original required/arrType', async ({ page }) => {
		await page.setViewportSize(VIEWPORT);
		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		const initialRequired = await getConditionRequiredByName(page, CONDITION_NAME);
		const initialNegate = await getConditionNegateByName(page, CONDITION_NAME);
		const initialArrType = await getConditionArrTypeByName(page, CONDITION_NAME);
		const localArrType = initialArrType === 'radarr' ? 'sonarr' : 'radarr';

		// Local changes required + arrType
		await setConditionRequiredByName(page, CONDITION_NAME, !initialRequired);
		await setConditionArrTypeByName(page, CONDITION_NAME, localArrType);
		await saveConditionChanges(page);

		// Dev changes negate
		await goToCustomFormatConditions(page, devId, TEST_CF_NAME);
		await setConditionNegateByName(page, CONDITION_NAME, !initialNegate);
		await saveConditionChanges(page);

		await exportAndPush(page, devId, 'e2e: 1.18 condition toggle conflict');
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		await alignConflict(page, TEST_CF_NAME);

		await goToCustomFormatConditions(page, localId, TEST_CF_NAME);
		expect(await getConditionRequiredByName(page, CONDITION_NAME)).toBe(initialRequired);
		expect(await getConditionArrTypeByName(page, CONDITION_NAME)).toBe(initialArrType);
		expect(await getConditionNegateByName(page, CONDITION_NAME)).toBe(!initialNegate);
	});
});
