/**
 * 2.23 Quality Profile — description conflict
 *
 * Setup: Both local and upstream change the same profile's description.
 * Conflict: guard_mismatch on description — both sides changed it.
 *
 * a) Override → local description
 * b) Align → upstream description (local description op dropped)
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
	openFirstQualityProfileGeneral,
	goToQualityProfileGeneral,
	updateQpDescription
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const LOCAL_DESCRIPTION = 'E2E 2.23 local description';
const DEV_DESCRIPTION = 'E2E 2.23 upstream description';

test.describe('2.23 QP description conflict', () => {
	let localId: number;
	let devId: number;
	let devHead: string;
	let profileName: string;

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

		profileName = await openFirstQualityProfileGeneral(page, localId);
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

	test('a) override — local description', async ({ page }) => {
		// Local: change description
		await goToQualityProfileGeneral(page, localId, profileName);
		await updateQpDescription(page, LOCAL_DESCRIPTION);

		// Dev: change description to a different value
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpDescription(page, DEV_DESCRIPTION);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.23 qp description conflict');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: local description wins
		await goToQualityProfileGeneral(page, localId, profileName);
		const description = await page.locator('#description').inputValue();
		expect(description).toContain(LOCAL_DESCRIPTION);
	});

	test('b) align — upstream description', async ({ page }) => {
		// Local: change description
		await goToQualityProfileGeneral(page, localId, profileName);
		await updateQpDescription(page, LOCAL_DESCRIPTION);

		// Dev: change description to a different value
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpDescription(page, DEV_DESCRIPTION);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.23 qp description conflict');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream description wins
		await goToQualityProfileGeneral(page, localId, profileName);
		const description = await page.locator('#description').inputValue();
		expect(description).toContain(DEV_DESCRIPTION);
	});
});
