/**
 * Helpers for viewing and resolving conflicts through the UI.
 */
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

function findConflictRows(page: Page, entityName: string): Locator {
	return page.locator('table tbody tr', { hasText: entityName });
}

async function submitConflictAction(
	page: Page,
	entityName: string,
	actionLabel: 'Align' | 'Override'
): Promise<void> {
	const rows = findConflictRows(page, entityName);
	await expect(rows.first()).toBeVisible();
	const beforeCount = await rows.count();

	const action = actionLabel.toLowerCase();
	const actionResponsePromise = page.waitForResponse((response) => {
		if (response.request().method() !== 'POST') return false;
		const url = response.url();
		return url.includes(`/conflicts?/${action}`) || url.includes(`/conflicts?%2F${action}`);
	});

	const [actionResponse] = await Promise.all([
		actionResponsePromise,
		rows.first().getByRole('button', { name: actionLabel }).click()
	]);

	if (!actionResponse.ok()) {
		throw new Error(`${actionLabel} conflict action failed with status ${actionResponse.status()}`);
	}

	// Wait for the UI to reflect the resolved conflict
	await expect
		.poll(async () => await findConflictRows(page, entityName).count(), { timeout: 20_000 })
		.toBeLessThan(beforeCount);
}

/**
 * Navigate to the conflicts page for a database.
 */
export async function goToConflicts(page: Page, databaseId: number): Promise<void> {
	await page.goto(`/databases/${databaseId}/conflicts`);
	await page.waitForLoadState('networkidle');
	await expect
		.poll(
			async () =>
				(await page.getByText('No conflicts detected').first().isVisible()) ||
				(await page.locator('table').first().isVisible()),
			{ timeout: 15_000 }
		)
		.toBe(true);
}

/**
 * Get the number of conflict rows visible in the table.
 */
export async function getConflictCount(page: Page): Promise<number> {
	const empty = page.getByText('No conflicts detected');
	if (await empty.isVisible()) return 0;

	const rows = page.locator('table tbody tr');
	return await rows.count();
}

/**
 * Find a conflict row by entity name.
 * Returns the table row locator.
 */
export function findConflictRow(page: Page, entityName: string): Locator {
	return page.locator('table tbody tr', { hasText: entityName });
}

/**
 * Click the Align button on a conflict row identified by entity name.
 */
export async function alignConflict(page: Page, entityName: string): Promise<void> {
	await submitConflictAction(page, entityName, 'Align');
}

/**
 * Click the Override button on a conflict row identified by entity name.
 */
export async function overrideConflict(page: Page, entityName: string): Promise<void> {
	await submitConflictAction(page, entityName, 'Override');
}

/**
 * Assert that a conflict exists for the given entity name.
 */
export async function expectConflict(page: Page, entityName: string): Promise<void> {
	const rows = findConflictRows(page, entityName);
	expect(await rows.count()).toBeGreaterThan(0);
}

/**
 * Assert that no conflict exists for the given entity name.
 */
export async function expectNoConflict(page: Page, entityName: string): Promise<void> {
	const rows = findConflictRows(page, entityName);
	expect(await rows.count()).toBe(0);
}
