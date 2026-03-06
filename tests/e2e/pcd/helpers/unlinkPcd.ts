/**
 * Unlink a PCD database instance through the UI.
 */
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { getDatabaseByName } from './db';

/**
 * Unlink a database by its ID via the settings page.
 */
export async function unlinkPcd(page: Page, databaseId: number): Promise<void> {
	// Dismiss any beforeunload dialogs from previous dirty forms
	page.on('dialog', (dialog) => dialog.accept());

	await page.goto(`/databases/${databaseId}/settings`);
	await page.waitForLoadState('networkidle');

	// Fast path: submit the hidden delete form directly (avoids brittle button selectors).
	const deleteForm = page.locator('form#delete-form');
	if ((await deleteForm.count()) > 0) {
		await Promise.all([
			page.waitForURL('**/databases', { timeout: 15_000 }),
			page.evaluate(() => {
				const form = document.getElementById('delete-form');
				if (form instanceof HTMLFormElement) {
					form.requestSubmit();
				}
			})
		]);
		return;
	}

	// Fallback: click through the modal flow.
	await page
		.getByRole('button', { name: /unlink/i })
		.first()
		.click();

	const modal = page.getByRole('dialog');
	await expect(modal).toBeVisible();
	await modal.getByRole('button', { name: /unlink/i }).click();

	await page.waitForURL('**/databases', { timeout: 15_000 });
}

/**
 * Unlink a database by name. No-op if it doesn't exist.
 */
export async function unlinkPcdByName(page: Page, name: string): Promise<void> {
	const db = getDatabaseByName(name);
	if (!db) return;
	await unlinkPcd(page, db.id);
}
