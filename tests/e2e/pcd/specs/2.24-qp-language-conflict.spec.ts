/**
 * 2.24 Quality Profile — language conflict
 *
 * Setup: Both local and upstream change the same profile's language.
 * Conflict: guard_mismatch on language — both sides changed it.
 *
 * a) Override → local language
 * b) Align → upstream language (local language op dropped)
 *
 * NOTE: Language is Radarr-only. The test database must have languages
 * available for this test to work.
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
import { openFirstQualityProfileGeneral, goToQualityProfileGeneral } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const LOCAL_LANGUAGE = 'French';
const DEV_LANGUAGE = 'German';

/** Select a language from the QP general form dropdown. */
async function setQpLanguage(
	page: import('@playwright/test').Page,
	language: string
): Promise<void> {
	const input = page.locator('input[name="language-search"]');
	await input.fill(language);
	await page.locator('button', { hasText: language }).first().click();
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');
}

/** Read the current language value from the hidden input. */
async function getQpLanguage(page: import('@playwright/test').Page): Promise<string> {
	return await page.locator('input[name="language"]').inputValue();
}

test.describe('2.24 QP language conflict', () => {
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

	test('a) override — local language', async ({ page }) => {
		// Local: change language
		await goToQualityProfileGeneral(page, localId, profileName);
		await setQpLanguage(page, LOCAL_LANGUAGE);

		// Dev: change language to a different value
		await goToQualityProfileGeneral(page, devId, profileName);
		await setQpLanguage(page, DEV_LANGUAGE);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.24 qp language conflict');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: local language wins
		await goToQualityProfileGeneral(page, localId, profileName);
		const language = await getQpLanguage(page);
		expect(language).toBe(LOCAL_LANGUAGE);
	});

	test('b) align — upstream language', async ({ page }) => {
		// Local: change language
		await goToQualityProfileGeneral(page, localId, profileName);
		await setQpLanguage(page, LOCAL_LANGUAGE);

		// Dev: change language to a different value
		await goToQualityProfileGeneral(page, devId, profileName);
		await setQpLanguage(page, DEV_LANGUAGE);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.24 qp language conflict');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream language wins
		await goToQualityProfileGeneral(page, localId, profileName);
		const language = await getQpLanguage(page);
		expect(language).toBe(DEV_LANGUAGE);
	});
});
