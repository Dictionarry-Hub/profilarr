/**
 * 2.17 Quality Profile — rename vs rename conflict
 *
 * Setup: Local renames profile. Upstream also renames it (differently).
 * Conflict: guard_mismatch on name column.
 *
 * a) Override → profile has user's desired name
 * b) Align → profile has upstream's name, user op dropped
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
	updateQpName
} from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';

test.describe('2.17 QP rename vs rename conflict', () => {
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

	test("a) override — profile gets user's desired name", async ({ page }) => {
		const localName = `${profileName} Local 2.17`;
		const devName = `${profileName} Dev 2.17`;

		// Local renames profile
		await goToQualityProfileGeneral(page, localId, profileName);
		await updateQpName(page, localName);

		// Dev renames same profile differently
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpName(page, devName);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 2.17 qp rename vs rename');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify profile has user's desired name
		await goToQualityProfileGeneral(page, localId, localName);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(localName);
	});

	test("b) align — profile keeps upstream's name", async ({ page }) => {
		const localName = `${profileName} Local 2.17`;
		const devName = `${profileName} Dev 2.17`;

		// Local renames profile
		await goToQualityProfileGeneral(page, localId, profileName);
		await updateQpName(page, localName);

		// Dev renames same profile differently
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpName(page, devName);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 2.17 qp rename vs rename');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify profile has upstream's name
		await goToQualityProfileGeneral(page, localId, devName);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(devName);
	});
});
