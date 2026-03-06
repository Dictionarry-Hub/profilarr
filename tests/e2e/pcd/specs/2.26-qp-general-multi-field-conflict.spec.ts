/**
 * 2.26 Quality Profile — general multi-field conflict
 *
 * Setup: Local changes description AND adds a tag in one save (two
 *        independent ops). Upstream changes description only.
 * Conflict: guard_mismatch on description — both sides changed it.
 *           Tag op is non-conflicting (different rows).
 *
 * a) Override → local description + local tag (both ops survive)
 * b) Align → upstream description + local tag (only description op
 *    dropped; tag op is independent and survives)
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
const LOCAL_DESCRIPTION = 'E2E 2.26 local description';
const DEV_DESCRIPTION = 'E2E 2.26 upstream description';
const LOCAL_TAG = 'e2e-2-26-local';

/** Change description and add a tag in one save. */
async function setDescriptionAndTag(
	page: import('@playwright/test').Page,
	description: string,
	tag: string
): Promise<void> {
	await fillMarkdownInput(page, 'description', description);
	const tagInput = page.locator('#tags-input');
	await tagInput.fill(tag);
	await tagInput.press('Enter');
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');
}

test.describe('2.26 QP general multi-field conflict', () => {
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

	test('a) override — local description + local tag', async ({ page }) => {
		// Local: change description + add tag in one save
		await goToQualityProfileGeneral(page, localId, profileName);
		await setDescriptionAndTag(page, LOCAL_DESCRIPTION, LOCAL_TAG);

		// Dev: change description only
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpDescription(page, DEV_DESCRIPTION);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.26 qp general multi-field conflict');

		// Pull into local → conflict on description
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Override
		await overrideConflict(page, profileName);

		// Verify: local description + local tag both survive
		await goToQualityProfileGeneral(page, localId, profileName);
		const description = await page.locator('#description').inputValue();
		expect(description).toContain(LOCAL_DESCRIPTION);

		const tagBadges = page.locator('span.inline-flex');
		const allText = await tagBadges.allInnerTexts();
		const tagNames = allText.map((t) =>
			t
				.replace(/\s*×?\s*$/, '')
				.trim()
				.toLowerCase()
		);
		expect(tagNames).toContain(LOCAL_TAG);
	});

	test('b) align — upstream description + local tag', async ({ page }) => {
		// Local: change description + add tag in one save
		await goToQualityProfileGeneral(page, localId, profileName);
		await setDescriptionAndTag(page, LOCAL_DESCRIPTION, LOCAL_TAG);

		// Dev: change description only
		await goToQualityProfileGeneral(page, devId, profileName);
		await updateQpDescription(page, DEV_DESCRIPTION);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.26 qp general multi-field conflict');

		// Pull into local → conflict on description
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, profileName);

		// Align
		await alignConflict(page, profileName);

		// Verify: upstream description wins, local tag survives
		await goToQualityProfileGeneral(page, localId, profileName);
		const description = await page.locator('#description').inputValue();
		expect(description).toContain(DEV_DESCRIPTION);

		const tagBadges = page.locator('span.inline-flex');
		const allText = await tagBadges.allInnerTexts();
		const tagNames = allText.map((t) =>
			t
				.replace(/\s*×?\s*$/, '')
				.trim()
				.toLowerCase()
		);
		expect(tagNames).toContain(LOCAL_TAG);
	});
});
