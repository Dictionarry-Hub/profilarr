/**
 * 1.8 Custom Format Tests — read-only without PAT
 *
 * Setup: Local ops enabled (no base writes). User attempts to add a CF test.
 * Expect: UI shows read-only alert and creation is blocked.
 */
import { test, expect } from '@playwright/test';
import { TEST_REPO_URL } from '../env';
import { linkPcd } from '../helpers/linkPcd';
import { unlinkPcdByName } from '../helpers/unlinkPcd';
import { goToCustomFormat } from '../helpers/entity';

const LOCAL_DB_NAME = 'E2E Local';
const TEST_CF_NAME = 'x265';
const READ_ONLY_MESSAGE = 'Entity tests are read-only for this database';

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAlertByType(page: import('@playwright/test').Page, type: 'Info' | 'Error') {
	const escaped = escapeRegex(READ_ONLY_MESSAGE);
	return page.getByRole('button', {
		name: new RegExp(`^${type}\\s+${escaped}\\.?$`)
	});
}

test.describe('1.8 CF tests read-only', () => {
	let localId: number;

	test.beforeEach(async ({ browser }) => {
		const page = await browser.newPage();
		await unlinkPcdByName(page, LOCAL_DB_NAME);

		localId = await linkPcd(page, {
			name: LOCAL_DB_NAME,
			repoUrl: TEST_REPO_URL,
			syncStrategy: 'Manual (no auto-sync)',
			autoPull: false
		});

		await page.close();
	});

	test.afterEach(async ({ browser }) => {
		const page = await browser.newPage();
		await unlinkPcdByName(page, LOCAL_DB_NAME);
		await page.close();
	});

	test('read-only blocks add and create', async ({ page }) => {
		await goToCustomFormat(page, localId, TEST_CF_NAME);

		const match = page.url().match(/\/custom-formats\/(\d+)\/(\d+)/);
		if (!match) {
			throw new Error(`Unexpected custom format URL: ${page.url()}`);
		}

		const testingUrl = `/custom-formats/${match[1]}/${match[2]}/testing`;
		await page.goto(testingUrl);
		await page.waitForLoadState('networkidle');

		await page.getByRole('button', { name: 'Add Test' }).click();
		const infoAlert = getAlertByType(page, 'Info');
		await expect(infoAlert).toBeVisible();
		await expect(page).toHaveURL(testingUrl);
		await infoAlert.click();
		await expect(infoAlert).toBeHidden();

		const newUrl = `/custom-formats/${match[1]}/${match[2]}/testing/new`;
		await page.goto(newUrl);
		await page.waitForLoadState('networkidle');

		await page.locator('#title').fill('Read-only test');
		const createResponse = page.waitForResponse(
			(response) =>
				response.request().method() === 'POST' && response.url().includes('/testing/new')
		);
		await page.getByRole('button', { name: 'Create' }).click();
		await createResponse;

		const errorAlert = getAlertByType(page, 'Error');
		await expect(errorAlert).toBeVisible();
		await expect(page).toHaveURL(newUrl);
	});
});
