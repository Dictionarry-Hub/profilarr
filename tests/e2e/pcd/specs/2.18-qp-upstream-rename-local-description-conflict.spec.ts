/**
 * 2.18 Quality Profile — upstream rename + local description conflict
 *
 * Setup: Local changes description. Upstream renames the profile.
 * Conflict: guard_mismatch — user's UPDATE guards on the old name, which
 *           upstream changed.
 *
 * a) Override → upstream name + local description
 * b) Align → upstream name + upstream description, user op dropped
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
	updateQpName,
	updateQpDescription
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const LOCAL_DESCRIPTION = 'E2E 2.18 local description edit';

test.describe('2.18 QP upstream rename + local description conflict', () => {
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

	test('a) override — upstream name + local description', async ({ page }) => {
		const devName = `${profileName} Dev 2.18`;

		// Local: change description only
		await goToQualityProfileGeneral(page, localId, profileName);
		await updateQpDescription(page, LOCAL_DESCRIPTION);

		// Dev: rename the profile
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpName(page, devName);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.18 qp upstream rename + local description');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: upstream name kept, local description applied
		await goToQualityProfileGeneral(page, localId, devName);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(devName);
		const description = await page.locator('#description').inputValue();
		expect(description).toContain(LOCAL_DESCRIPTION);
	});

	test('b) align — upstream name + upstream description', async ({ page }) => {
		const devName = `${profileName} Dev 2.18`;

		// Local: change description only
		await goToQualityProfileGeneral(page, localId, profileName);
		await updateQpDescription(page, LOCAL_DESCRIPTION);

		// Dev: rename the profile
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpName(page, devName);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.18 qp upstream rename + local description');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream name, local description gone
		await goToQualityProfileGeneral(page, localId, devName);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(devName);
		const description = await page.locator('#description').inputValue();
		expect(description).not.toContain(LOCAL_DESCRIPTION);
	});
});
