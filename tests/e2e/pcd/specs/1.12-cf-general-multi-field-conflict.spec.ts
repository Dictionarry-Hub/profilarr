/**
 * 1.12 Custom Format — general multi-field conflict
 *
 * Setup: Local changes description only. Upstream changes description,
 * include_in_rename, and tags in the same save.
 * Conflict: description guard mismatch.
 *
 * a) Override → description uses local, include/tags use upstream
 * b) Align → description/include/tags use upstream
 */
import { test, expect, type Page } from '@playwright/test';
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
	goToCustomFormatGeneral,
	updateCfDescription,
	addCfTag,
	getCfIncludeInRename
} from '../helpers/entity';
import { fillMarkdownInput } from '../helpers/markdown';
import { setIconCheckboxByLabel } from '../helpers/checkbox';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_CF_NAME = 'x265';
const LOCAL_DESCRIPTION = 'Local description 1.12';
const DEV_DESCRIPTION = 'Dev description 1.12';
const DEV_TAG = 'DevTag-1-12';

async function applyUpstreamGeneralChanges(
	page: Page,
	devId: number
): Promise<{ includeInRename: boolean }> {
	await goToCustomFormatGeneral(page, devId, TEST_CF_NAME);

	const includeNext = !(await getCfIncludeInRename(page));

	await fillMarkdownInput(page, 'description', DEV_DESCRIPTION);
	await setIconCheckboxByLabel(page, 'Include In Rename', includeNext);
	await addCfTag(page, DEV_TAG);

	await page.getByRole('button', { name: 'Save Changes' }).click();
	await page.waitForLoadState('networkidle');

	return { includeInRename: includeNext };
}

test.describe('1.12 CF general multi-field conflict', () => {
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

	test('a) override — keep local description, upstream include/tags', async ({ page }) => {
		// Local edits description only
		await goToCustomFormatGeneral(page, localId, TEST_CF_NAME);
		await updateCfDescription(page, LOCAL_DESCRIPTION);

		// Dev edits description + include + tags
		const { includeInRename } = await applyUpstreamGeneralChanges(page, devId);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.12 general multi-field conflict');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		// Override
		await overrideConflict(page, TEST_CF_NAME);

		// Verify local description + upstream include/tags
		await goToCustomFormatGeneral(page, localId, TEST_CF_NAME);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(LOCAL_DESCRIPTION);
		expect(await getCfIncludeInRename(page)).toBe(includeInRename);
		await expect(page.getByText(DEV_TAG)).toBeVisible();
	});

	test('b) align — keep upstream description/include/tags', async ({ page }) => {
		// Local edits description only
		await goToCustomFormatGeneral(page, localId, TEST_CF_NAME);
		await updateCfDescription(page, LOCAL_DESCRIPTION);

		// Dev edits description + include + tags
		const { includeInRename } = await applyUpstreamGeneralChanges(page, devId);

		// Dev exports and pushes
		await exportAndPush(page, devId, 'e2e: 1.12 general multi-field conflict');

		// Local pulls → conflict
		await pullChanges(page, localId);

		// Verify conflict exists
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_CF_NAME);

		// Align
		await alignConflict(page, TEST_CF_NAME);

		// Verify upstream description + include/tags
		await goToCustomFormatGeneral(page, localId, TEST_CF_NAME);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(DEV_DESCRIPTION);
		expect(descriptionText).not.toContain(LOCAL_DESCRIPTION);
		expect(await getCfIncludeInRename(page)).toBe(includeInRename);
		await expect(page.getByText(DEV_TAG)).toBeVisible();
	});
});
