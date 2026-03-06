/**
 * 1.27 Custom Format — local rename + local description, upstream description change
 *
 * Setup: User renames CF and changes description in one save.
 * Upstream changes description only.
 * Conflict: description guard mismatch.
 *
 * a) Override → CF keeps user's new name + local description
 * b) Align → CF keeps upstream name + upstream description
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
import { goToCustomFormatGeneral } from '../helpers/entity';
import { fillMarkdownInput } from '../helpers/markdown';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const BASE_CF_NAME = 'x265';

const LOCAL_NAME_PREFIX = 'E2E Rename+Desc 1.27';
const LOCAL_DESCRIPTION = 'Local description 1.27';
const DEV_DESCRIPTION = 'Upstream description 1.27';

async function setNameAndDescription(
	page: import('@playwright/test').Page,
	name: string,
	description: string
): Promise<void> {
	await page.locator('#name').fill(name);
	await fillMarkdownInput(page, 'description', description);
	await page.getByRole('button', { name: 'Save Changes' }).click();
	await page.waitForLoadState('networkidle');
}

async function expectCustomFormatMissing(
	page: import('@playwright/test').Page,
	databaseId: number,
	name: string
): Promise<void> {
	await page.goto(`/custom-formats/${databaseId}`);
	await page.waitForLoadState('networkidle');
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const exactName = new RegExp(`^${escaped}$`);
	const nameCell = page.locator('div.font-medium', { hasText: exactName });
	const row = page.locator('table tbody tr').filter({ has: nameCell });
	await expect(row).toHaveCount(0);
}

test.describe('1.27 CF local rename + description vs upstream description', () => {
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

	test('a) override — local rename + local description', async ({ page }) => {
		// Local renames + updates description in one save
		await goToCustomFormatGeneral(page, localId, BASE_CF_NAME);
		await setNameAndDescription(page, localRename, LOCAL_DESCRIPTION);

		// Dev changes description only
		await goToCustomFormatGeneral(page, devId, BASE_CF_NAME);
		await setNameAndDescription(page, BASE_CF_NAME, DEV_DESCRIPTION);
		await exportAndPush(page, devId, 'e2e: 1.27 upstream description');

		// Local pulls → conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, localRename);

		await overrideConflict(page, localRename);

		await goToCustomFormatGeneral(page, localId, localRename);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(LOCAL_DESCRIPTION);
		await expectCustomFormatMissing(page, localId, BASE_CF_NAME);
	});

	test('b) align — upstream name + upstream description', async ({ page }) => {
		// Local renames + updates description in one save
		await goToCustomFormatGeneral(page, localId, BASE_CF_NAME);
		await setNameAndDescription(page, localRename, LOCAL_DESCRIPTION);

		// Dev changes description only
		await goToCustomFormatGeneral(page, devId, BASE_CF_NAME);
		await setNameAndDescription(page, BASE_CF_NAME, DEV_DESCRIPTION);
		await exportAndPush(page, devId, 'e2e: 1.27 upstream description');

		// Local pulls → conflict
		await pullChanges(page, localId);
		await goToConflicts(page, localId);
		await expectConflict(page, localRename);

		await alignConflict(page, localRename);

		await goToCustomFormatGeneral(page, localId, BASE_CF_NAME);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(DEV_DESCRIPTION);
		await expectCustomFormatMissing(page, localId, localRename);
	});
});
