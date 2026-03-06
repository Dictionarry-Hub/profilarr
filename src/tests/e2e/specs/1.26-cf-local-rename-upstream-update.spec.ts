/**
 * 1.26 Custom Format — local rename + upstream update (no conflict)
 *
 * Setup: User renames CF. Upstream updates description.
 * Expected: No conflict. Final CF keeps user's name and upstream description.
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, expectNoConflict } from '../helpers/conflicts';
import { goToCustomFormatGeneral, updateCfName, updateCfDescription } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const BASE_CF_NAME = 'x265';

const LOCAL_NAME_PREFIX = 'E2E Local Rename 1.26';
const DEV_DESCRIPTION = 'Upstream description for 1.26';

test.describe('1.26 CF local rename upstream update', () => {
	let localId: number;
	let devId: number;
	let devHead: string;
	let localRename: string;

	test.beforeEach(async ({ browser }) => {
		const page = await browser.newPage();
		const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		localRename = `${LOCAL_NAME_PREFIX} ${runId}`;

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

	test('no conflict — local rename + upstream description', async ({ page }) => {
		// Local renames CF
		await goToCustomFormatGeneral(page, localId, BASE_CF_NAME);
		await updateCfName(page, localRename);

		// Dev updates description
		await goToCustomFormatGeneral(page, devId, BASE_CF_NAME);
		await updateCfDescription(page, DEV_DESCRIPTION);
		await exportAndPush(page, devId, 'e2e: 1.26 upstream description');

		// Local pulls → no conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectNoConflict(page, localRename);

		// Verify final state: renamed + upstream description
		await goToCustomFormatGeneral(page, localId, localRename);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(DEV_DESCRIPTION);
	});
});
