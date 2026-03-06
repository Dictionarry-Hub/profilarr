/**
 * 1.2 Custom Format — description change conflict
 *
 * Setup: User changes a CF's description. Upstream also changes it.
 * Conflict: guard_mismatch on description column.
 *
 * a) Override → CF has user's desired description
 * b) Align → CF has upstream's description, user op dropped
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
import { goToCustomFormat, updateCfDescription } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';

test.describe('1.2 CF description change conflict', () => {
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

	test("a) override — CF gets user's desired description", async ({ page }) => {
		// Local edits CF description
		await goToCustomFormat(page, localId, TEST_CF_NAME);
		await updateCfDescription(page, 'Local description edit');

		// Dev edits same CF description differently
		await goToCustomFormat(page, devId, TEST_CF_NAME);
		await updateCfDescription(page, 'Dev description edit');

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.2 description conflict');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		// Override
		await overrideConflict(page, TEST_CF_NAME);

		// Verify CF has user's desired description
		await goToCustomFormat(page, localId, TEST_CF_NAME);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain('Local description edit');
	});

	test("b) align — CF keeps upstream's description", async ({ page }) => {
		// Local edits CF description
		await goToCustomFormat(page, localId, TEST_CF_NAME);
		await updateCfDescription(page, 'Local description edit');

		// Dev edits same CF description differently
		await goToCustomFormat(page, devId, TEST_CF_NAME);
		await updateCfDescription(page, 'Dev description edit');

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.2 description conflict');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		// Align
		await alignConflict(page, TEST_CF_NAME);

		// Verify CF has upstream's description
		await goToCustomFormat(page, localId, TEST_CF_NAME);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain('Dev description edit');
	});
});
