/**
 * 2.12 Quality Profile — scoring upgrade-until score desired already matches upstream
 *
 * Setup: Local changes upgrade-until score. Upstream sets same upgrade-until score.
 * Expected: Auto-align (no conflict). Local op is dropped.
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL, TEST_PAT, TEST_GIT_NAME, TEST_GIT_EMAIL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { pullChanges, exportAndPush } from '../helpers/sync';
import { goToConflicts, getConflictCount } from '../helpers/conflicts';
import { openFirstQualityProfileGeneral, goToQualityProfileScoring } from '../helpers/entity';
import { getHead, resetToCommit } from '../helpers/reset';

const LOCAL_DB_NAME = 'E2E Local';
const DEV_DB_NAME = 'E2E Dev';

test.describe('2.12 QP scoring upgrade-until score desired already matches upstream', () => {
	test.describe.configure({ timeout: 120_000 });

	let localId: number;
	let devId: number;
	let devHead: string;
	let profileName: string;
	let desiredUpgradeUntilScore: number;

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

	test('auto-align', async ({ page }) => {
		await goToQualityProfileScoring(page, localId, profileName);
		const localInput = page.locator('input[name="upgradeUntilScore"]:not([type="hidden"])');
		const localCurrent = Number(await localInput.inputValue());
		desiredUpgradeUntilScore = localCurrent + 13;
		await localInput.fill(String(desiredUpgradeUntilScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		await goToQualityProfileScoring(page, devId, profileName);
		const devInput = page.locator('input[name="upgradeUntilScore"]:not([type="hidden"])');
		await devInput.fill(String(desiredUpgradeUntilScore));
		await page.getByRole('button', { name: 'Save' }).click();
		await page.waitForLoadState('networkidle');

		await exportAndPush(
			page,
			devId,
			'e2e: 2.12 qp scoring upgrade-until score desired matches upstream auto-align'
		);
		await pullChanges(page, localId);

		await goToConflicts(page, localId);
		expect(await getConflictCount(page)).toBe(0);

		await page.goto(`/databases/${localId}/changes`);
		await page.waitForLoadState('networkidle');
		await expect
			.poll(
				async () =>
					(await page.getByText('No changes to pull or publish right now.').isVisible()) ||
					(await page.getByText('No unpublished changes').isVisible()),
				{ timeout: 15_000 }
			)
			.toBe(true);

		await goToQualityProfileScoring(page, localId, profileName);
		const finalInput = page.locator('input[name="upgradeUntilScore"]:not([type="hidden"])');
		expect(Number(await finalInput.inputValue())).toBe(desiredUpgradeUntilScore);
	});
});
