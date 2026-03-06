/**
 * 2.40 Quality Profile — create duplicate (general-only payload)
 *
 * Setup: Local creates QP "E2E Duplicate QP" with description A.
 *        Upstream creates QP with same name but description B.
 * Conflict: duplicate_key — UNIQUE constraint on name.
 *
 * a) Override → QP has local's description
 * b) Align → QP has upstream's description, local op dropped
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
import { goToQualityProfileGeneral } from '../helpers/entity';
import { fillMarkdownInput } from '../helpers/markdown';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';
const TEST_QP_NAME = 'E2E Duplicate QP';
const LOCAL_DESCRIPTION = 'Local create description';
const DEV_DESCRIPTION = 'Upstream create description';

async function createQualityProfile(
	page: import('@playwright/test').Page,
	databaseId: number,
	name: string,
	description: string
): Promise<void> {
	await page.goto(`/quality-profiles/${databaseId}/new`);
	await page.waitForLoadState('networkidle');
	await page.locator('input[name="name"]').fill(name);
	await fillMarkdownInput(page, 'description', description);
	await page.getByRole('button', { name: 'Create' }).click();
	await page.waitForURL(new RegExp(`/quality-profiles/${databaseId}/\\d+/scoring`), {
		timeout: 15_000
	});
	await page.waitForLoadState('networkidle');
}

test.describe('2.40 QP create duplicate (general-only)', () => {
	test.describe.configure({ timeout: 120_000 });

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

	test('a) override — QP has local description', async ({ page }) => {
		// Local creates QP
		await createQualityProfile(page, localId, TEST_QP_NAME, LOCAL_DESCRIPTION);

		// Dev creates QP with same name but different description
		await createQualityProfile(page, devId, TEST_QP_NAME, DEV_DESCRIPTION);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.40 qp create duplicate general only');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_QP_NAME);

		// Override
		await overrideConflict(page, TEST_QP_NAME);

		// Verify: local description wins
		await goToQualityProfileGeneral(page, localId, TEST_QP_NAME);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(LOCAL_DESCRIPTION);
	});

	test('b) align — QP has upstream description', async ({ page }) => {
		// Local creates QP
		await createQualityProfile(page, localId, TEST_QP_NAME, LOCAL_DESCRIPTION);

		// Dev creates QP with same name but different description
		await createQualityProfile(page, devId, TEST_QP_NAME, DEV_DESCRIPTION);

		// Push upstream
		await exportAndPush(page, devId, 'e2e: 2.40 qp create duplicate general only');

		// Pull into local → conflict
		await pullChanges(page, localId);

		// Verify conflict
		await goToConflicts(page, localId);
		await expectConflict(page, TEST_QP_NAME);

		// Align
		await alignConflict(page, TEST_QP_NAME);

		// Verify: upstream description wins
		await goToQualityProfileGeneral(page, localId, TEST_QP_NAME);
		const descriptionText = await page.locator('#description').inputValue();
		expect(descriptionText).toContain(DEV_DESCRIPTION);
	});
});
