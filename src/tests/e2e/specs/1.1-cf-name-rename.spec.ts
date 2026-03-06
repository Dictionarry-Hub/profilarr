/**
 * 1.1 Custom Format — name rename conflict
 *
 * Setup: User renames a CF. Upstream also renames it.
 * Conflict: guard_mismatch on name column.
 *
 * a) Override → CF has user's desired name
 * b) Align → CF has upstream's name, user op dropped
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
import { goToCustomFormat, updateCfName } from '../helpers/entity';
import { getConflicts, findOpByEntityName } from '../helpers/db';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';

test.describe('1.1 CF name rename conflict', () => {
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
		// Reset dev repo if it was set up (may be undefined if beforeEach failed)
		if (devId && devHead) {
			try {
				resetToCommit(devId, devHead, true);
			} catch {
				// Best-effort reset; unlinking below will remove the clone anyway
			}
		}

		const page = await browser.newPage();
		await unlinkPcdByName(page, LOCAL_DB_NAME);
		await unlinkPcdByName(page, DEV_DB_NAME);
		await page.close();
	});

	test("a) override — CF gets user's desired name", async ({ page }) => {
		// Local renames CF
		await goToCustomFormat(page, localId, TEST_CF_NAME);
		await updateCfName(page, 'x265 Local Rename');

		// Dev renames same CF differently
		await goToCustomFormat(page, devId, TEST_CF_NAME);
		await updateCfName(page, 'x265 Dev Rename');

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.1 name rename');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, 'x265');

		// Override
		await overrideConflict(page, 'x265');

		// Verify CF has user's desired name
		await goToCustomFormat(page, localId, 'x265 Local Rename');
		const name = await page.locator('#name').inputValue();
		expect(name).toBe('x265 Local Rename');
	});

	test("b) align — CF keeps upstream's name", async ({ page }) => {
		// Local renames CF
		await goToCustomFormat(page, localId, TEST_CF_NAME);
		await updateCfName(page, 'x265 Local Rename');

		// Dev renames same CF differently
		await goToCustomFormat(page, devId, TEST_CF_NAME);
		await updateCfName(page, 'x265 Dev Rename');

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.1 name rename');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, 'x265');

		// Align
		await alignConflict(page, 'x265');

		// Verify CF has upstream's name
		await goToCustomFormat(page, localId, 'x265 Dev Rename');
		const name = await page.locator('#name').inputValue();
		expect(name).toBe('x265 Dev Rename');
	});
});
