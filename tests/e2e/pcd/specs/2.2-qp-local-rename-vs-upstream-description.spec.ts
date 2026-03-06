/**
 * 2.2 Quality Profile — local rename vs upstream description
 *
 * Setup: Local renames profile. Upstream updates description.
 * Expected: No conflict. Local name persists and upstream description applies.
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, expectNoConflict } from '../helpers/conflicts';
import {
	openFirstQualityProfileGeneral,
	goToQualityProfileGeneral,
	updateQpName,
	updateQpDescription
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const DEV_DESCRIPTION = 'E2E 2.2 upstream description edit';

test.describe('2.2 QP local rename vs upstream description', () => {
	let localId: number;
	let devId: number;
	let devHead: string;
	let profileName: string;
	let localRenamedName: string;

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
		localRenamedName = `${profileName} Local 2.2`;
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

	test('no conflict', async ({ page }) => {
		// Local: rename-only update
		await goToQualityProfileGeneral(page, localId, profileName);
		await updateQpName(page, localRenamedName);

		// Dev: description-only update on original name
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpDescription(page, DEV_DESCRIPTION);

		// Push upstream change
		await exportAndPush(page, devId, 'e2e: 2.2 qp local rename vs upstream description');

		// Pull into local
		await pullChanges(page, localId);

		// Verify no conflict row for either old or new name
		await goToConflicts(page, localId);
		await expectNoConflict(page, profileName);
		await expectNoConflict(page, localRenamedName);

		// Verify local renamed name + upstream description
		await goToQualityProfileGeneral(page, localId, localRenamedName);
		const finalName = await page.locator('#name').inputValue();
		expect(finalName).toBe(localRenamedName);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(DEV_DESCRIPTION);
	});
});
