/**
 * 1.3 Custom Format — include_in_rename auto-align (no conflict)
 *
 * Setup: User toggles include_in_rename. Upstream sets the same value.
 * Expected: No conflict (auto-align drops the user op).
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, getConflictCount } from '../helpers/conflicts';
import { goToCustomFormat, getCfIncludeInRename, updateCfIncludeInRename } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';

test.describe('1.3 CF include_in_rename auto-align', () => {
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

	test('auto-align drops user op (no conflict)', async ({ page }) => {
		// Local toggles include_in_rename to desired value
		await goToCustomFormat(page, localId, TEST_CF_NAME);
		const initial = await getCfIncludeInRename(page);
		const desired = !initial;
		await updateCfIncludeInRename(page, desired);

		// Dev sets the same desired value
		await goToCustomFormat(page, devId, TEST_CF_NAME);
		await updateCfIncludeInRename(page, desired);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.3 include_in_rename auto-align');

		// Local pulls → should auto-align (no conflict)
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		const conflictCount = await getConflictCount(page);
		expect(conflictCount).toBe(0);

		// Verify final state matches desired value
		await goToCustomFormat(page, localId, TEST_CF_NAME);
		const finalValue = await getCfIncludeInRename(page);
		expect(finalValue).toBe(desired);
	});
});
