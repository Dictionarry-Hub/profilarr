/**
 * 2.6 Quality Profile — local description change with upstream same value
 *
 * Setup: Local changes description. Upstream sets the same description value.
 * Expected: Auto-align (no conflict).
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, getConflictCount } from '../helpers/conflicts';
import {
	openFirstQualityProfileGeneral,
	goToQualityProfileGeneral,
	updateQpDescription
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';

test.describe('2.6 QP local description change with upstream same value', () => {
	test.describe.configure({ timeout: 120_000 });

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

	test('auto-align', async ({ page }) => {
		const seed = `E2E 2.6 shared description ${Date.now()}`;

		// Local sets desired description value
		await goToQualityProfileGeneral(page, localId, profileName);
		const currentDescription = await page.locator('#description').inputValue();
		const desiredDescription = currentDescription === seed ? `${seed} alt` : seed;
		await updateQpDescription(page, desiredDescription);

		// Dev sets the same desired value
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpDescription(page, desiredDescription);

		// Push upstream change
		await exportAndPush(page, devId, 'e2e: 2.6 qp description same value auto-align');

		// Pull into local -> should auto-align (no conflict)
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		const conflictCount = await getConflictCount(page);
		expect(conflictCount).toBe(0);

		// Final value should be the shared desired value
		await goToQualityProfileGeneral(page, localId, profileName);
		const finalDescription = await page.locator('#description').inputValue();
		expect(finalDescription).toContain(desiredDescription);
	});
});
