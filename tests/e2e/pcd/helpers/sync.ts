/**
 * Helpers for syncing — pulling incoming changes and exporting/pushing outgoing changes.
 */
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Navigate to the changes tab and pull incoming changes.
 * Waits for the pull to complete and verifies success.
 */
export async function pullChanges(page: Page, databaseId: number): Promise<void> {
	await page.goto(`/databases/${databaseId}/changes`);
	await page.waitForLoadState('networkidle');

	const incomingHeading = page.getByRole('heading', { name: 'Incoming Changes' });
	const quietState = page.getByText('No changes to pull or publish right now.').first();
	const allCaughtUp = page.getByText(/All caught up\./).first();

	const pullButton = page.getByRole('button', { name: /^Pull \d+ commit/ });
	if (!(await incomingHeading.isVisible()) && !(await quietState.isVisible())) {
		await expect
			.poll(async () => (await incomingHeading.isVisible()) || (await quietState.isVisible()), {
				timeout: 30_000
			})
			.toBe(true);
	}

	if (await quietState.isVisible()) {
		return;
	}

	if (!(await pullButton.isVisible())) {
		await expect
			.poll(
				async () =>
					(await allCaughtUp.isVisible()) ||
					(await quietState.isVisible()) ||
					!(await pullButton.isVisible()),
				{ timeout: 30_000 }
			)
			.toBe(true);
		return;
	}

	const pullErrorAlerts = page.locator('[role="button"]', { hasText: 'Pull failed:' });
	const errorCountBefore = await pullErrorAlerts.count();

	const pullResponsePromise = page.waitForResponse((response) => {
		if (response.request().method() !== 'POST') return false;
		const url = response.url();
		return url.includes('/changes?/pull') || url.includes('/changes?%2Fpull');
	});

	const [pullResponse] = await Promise.all([pullResponsePromise, pullButton.click()]);
	if (!pullResponse.ok()) {
		throw new Error(`Pull request failed with status ${pullResponse.status()}`);
	}

	// Wait for pull to finish with either success (up-to-date state) or an explicit error alert.
	let outcome: 'pending' | 'success' | 'error' = 'pending';
	await expect
		.poll(
			async () => {
				if ((await pullErrorAlerts.count()) > errorCountBefore) {
					outcome = 'error';
					return outcome;
				}
				if (
					(await allCaughtUp.isVisible()) ||
					(await quietState.isVisible()) ||
					!(await pullButton.isVisible())
				) {
					outcome = 'success';
					return outcome;
				}
				outcome = 'pending';
				return outcome;
			},
			{ timeout: 45_000 }
		)
		.not.toBe('pending');

	if (outcome === 'error') {
		const message = (await pullErrorAlerts.nth(errorCountBefore).innerText()).trim();
		throw new Error(`Pull failed: ${message}`);
	}
}

/**
 * Export and push outgoing changes on the dev database.
 * Selects all changes, fills commit message, previews, and confirms.
 */
export async function exportAndPush(
	page: Page,
	databaseId: number,
	commitMessage: string
): Promise<void> {
	await page.goto(`/databases/${databaseId}/changes`);
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('heading', { name: 'Outgoing Changes' })).toBeVisible();

	const noChanges = page.getByText('No unpublished changes');
	const selectAllButton = page.getByRole('button', { name: /Select all/ });

	await expect(selectAllButton).toBeVisible({ timeout: 15_000 });

	await expect
		.poll(
			async () => {
				if (await noChanges.isVisible()) return 'none';
				const text = await selectAllButton.innerText();
				const match = text.match(/\((\d+)\)/);
				if (match && Number(match[1]) > 0) return 'ready';
				const rowCount = await page.locator('table tbody tr').count();
				return rowCount > 0 ? 'rows' : 'wait';
			},
			{ timeout: 15_000 }
		)
		.not.toBe('wait');

	if (await noChanges.isVisible()) {
		throw new Error('No unpublished changes to export.');
	}

	const selectAllText = await selectAllButton.innerText();
	const selectAllMatch = selectAllText.match(/\((\d+)\)/);
	const selectableCount = selectAllMatch ? Number(selectAllMatch[1]) : 0;
	if (selectableCount === 0) {
		throw new Error('No selectable changes to export.');
	}

	// Click "Select all" to select all draft changes
	await selectAllButton.click();

	// Fill the commit message
	await page.getByPlaceholder('Commit message...').fill(commitMessage);

	// Click the Preview button (upload icon, title "Preview export")
	await page.getByTitle('Preview export').click();

	// Wait for preview modal to load
	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();

	// Wait for preview to finish loading (Approve button becomes enabled)
	await expect(modal.getByRole('button', { name: 'Approve & Export' })).toBeEnabled({
		timeout: 15_000
	});

	// Click Approve & Export
	const commitResponsePromise = page.waitForResponse((response) => {
		if (response.request().method() !== 'POST') return false;
		const url = response.url();
		return url.includes('/changes?/commit') || url.includes('/changes?%2Fcommit');
	});

	const [commitResponse] = await Promise.all([
		commitResponsePromise,
		modal.getByRole('button', { name: 'Approve & Export' }).click()
	]);

	if (!commitResponse.ok()) {
		throw new Error(`Export request failed with status ${commitResponse.status()}`);
	}

	// Wait for success — modal closes and changes list refreshes
	await expect(modal).not.toBeVisible({ timeout: 45_000 });
}

/**
 * Check if there are incoming changes without pulling them.
 */
export async function hasIncomingChanges(page: Page, databaseId: number): Promise<boolean> {
	await page.goto(`/databases/${databaseId}/changes`);
	await page.waitForLoadState('networkidle');
	await expect(page.getByText('Incoming Changes')).toBeVisible();

	const pullButton = page.getByRole('button', { name: /^Pull \d+ commit/ });
	return await pullButton.isVisible();
}
