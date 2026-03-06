/**
 * Helpers for labeled boolean controls.
 * Supports both legacy IconCheckbox (<button role="checkbox">) and Toggle (<div role="switch">).
 */
import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

function getBooleanControlBySectionLabel(page: Page, label: string): Locator {
	const section = page.locator('div.space-y-2', { hasText: label }).first();
	return section.locator('[role="switch"], button[role="checkbox"]').first();
}

export async function isIconCheckboxCheckedByLabel(page: Page, label: string): Promise<boolean> {
	const control = getBooleanControlBySectionLabel(page, label);
	await expect(control).toBeVisible();
	return (await control.getAttribute('aria-checked')) === 'true';
}

export async function setIconCheckboxByLabel(
	page: Page,
	label: string,
	enabled: boolean
): Promise<void> {
	const control = getBooleanControlBySectionLabel(page, label);
	await expect(control).toBeVisible();
	const isChecked = (await control.getAttribute('aria-checked')) === 'true';
	if (isChecked !== enabled) {
		await control.click();
	}
}
