/**
 * 2.21 Quality Profile — local rename+description vs upstream description
 *
 * Setup: Local renames the profile AND changes description in one save.
 *        Upstream changes description only.
 * Conflict: guard_mismatch on description — both sides changed it.
 *
 * a) Override → local name + local description (user's full desired state)
 * b) Align → local name kept + upstream description (only description op
 *    dropped; rename is a separate non-conflicting op that survives)
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
import { fillMarkdownInput } from '../helpers/markdown';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const LOCAL_DESCRIPTION = 'E2E 2.21 local description';
const DEV_DESCRIPTION = 'E2E 2.21 upstream description';

/** Fill name + description in one save on the QP general page. */
async function setQpNameAndDescription(
	page: import('@playwright/test').Page,
	name: string,
	description: string
): Promise<void> {
	await page.locator('#name').fill(name);
	await fillMarkdownInput(page, 'description', description);
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');
}

test.describe('2.21 QP local rename+description vs upstream description', () => {
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

	test('a) override — local name + local description', async ({ page }) => {
		const localName = `${profileName} Local 2.21`;

		// Local: rename + change description in one save
		await goToQualityProfileGeneral(page, localId, profileName);
		await setQpNameAndDescription(page, localName, LOCAL_DESCRIPTION);

		// Dev: change description only
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpDescription(page, DEV_DESCRIPTION);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.21 qp local rename+desc vs upstream desc');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Conflict shows under the local renamed name
		await goToConflicts(page, localId);
		await expectConflict(page, localName);

		// Override
		await overrideConflict(page, localName);

		// Verify: local name + local description
		await goToQualityProfileGeneral(page, localId, localName);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(localName);
		const description = await page.locator('#description').inputValue();
		expect(description).toContain(LOCAL_DESCRIPTION);
	});

	test('b) align — local name kept + upstream description', async ({ page }) => {
		const localName = `${profileName} Local 2.21`;

		// Local: rename + change description in one save
		await goToQualityProfileGeneral(page, localId, profileName);
		await setQpNameAndDescription(page, localName, LOCAL_DESCRIPTION);

		// Dev: change description only
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpDescription(page, DEV_DESCRIPTION);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.21 qp local rename+desc vs upstream desc');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Conflict shows under the local renamed name
		await goToConflicts(page, localId);
		await expectConflict(page, localName);

		// Align
		await alignConflict(page, localName);

		// Verify: local rename stays (non-conflicting op), upstream description wins
		// QP general produces separate ops for rename and description.
		// Only the description op conflicted, so align drops only that one.
		await goToQualityProfileGeneral(page, localId, localName);
		const name = await page.locator('#name').inputValue();
		expect(name).toBe(localName);
		const description = await page.locator('#description').inputValue();
		expect(description).toContain(DEV_DESCRIPTION);
	});
});
