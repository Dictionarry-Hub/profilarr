/**
 * 1.4 Custom Format — upstream rename + user description change
 *
 * Setup: User changes description. Upstream renames the CF.
 * Conflict: guard mismatch on name column.
 *
 * a) Override → CF keeps upstream's name, user's description applied
 * b) Align → CF has upstream's name and upstream's description
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
import { goToCustomFormat, updateCfDescription, updateCfName } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';
const DEV_RENAME = 'x265 Dev Rename';
const LOCAL_DESCRIPTION = 'Local description edit';

test.describe('1.4 CF upstream rename + user description change', () => {
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

	test('a) override — CF keeps upstream name, user description', async ({ page }) => {
		// Update description locally
		await goToCustomFormat(page, localId, TEST_CF_NAME);
		await updateCfDescription(page, LOCAL_DESCRIPTION);

		// Dev renames the CF
		await goToCustomFormat(page, devId, TEST_CF_NAME);
		await updateCfName(page, DEV_RENAME);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.4 upstream rename + user description');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		// Override
		await overrideConflict(page, TEST_CF_NAME);

		// Verify CF has upstream's name, user's description
		await goToCustomFormat(page, localId, DEV_RENAME);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(DEV_RENAME);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(LOCAL_DESCRIPTION);
	});

	test('b) align — CF keeps upstream name and description', async ({ page }) => {
		// Capture original description, then update locally
		await goToCustomFormat(page, localId, TEST_CF_NAME);
		const originalDescription = (await page.locator('#description').inputValue()).trim();
		await updateCfDescription(page, LOCAL_DESCRIPTION);

		// Dev renames the CF
		await goToCustomFormat(page, devId, TEST_CF_NAME);
		await updateCfName(page, DEV_RENAME);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.4 upstream rename + user description');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		// Align
		await alignConflict(page, TEST_CF_NAME);

		// Verify CF has upstream's name and original description
		await goToCustomFormat(page, localId, DEV_RENAME);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(DEV_RENAME);
		const descriptionText = (await page.locator('#description').inputValue()).trim();
		expect(descriptionText).toBe(originalDescription);
	});
});
