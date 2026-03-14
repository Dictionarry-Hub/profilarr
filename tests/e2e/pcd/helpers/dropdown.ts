/**
 * Helper for interacting with DropdownSelect components.
 * These render a Button showing the current value; clicking opens a list of options.
 */
import type { Page, Locator } from '@playwright/test';

/**
 * Select a value from a DropdownSelect component.
 * @param scope - A locator scoped to the dropdown's container (e.g., a section with label text)
 * @param optionLabel - The visible label of the option to select
 */
export async function selectDropdownOption(scope: Locator, optionLabel: string): Promise<void> {
	await scope.scrollIntoViewIfNeeded();

	// DropdownSelect wraps the actual button inside Tooltip, so the trigger is a descendant.
	const trigger = scope.locator('div.relative').getByRole('button').first();
	await trigger.waitFor({ state: 'visible', timeout: 10_000 });
	await trigger.click({ force: true });
}

/**
 * Select a dropdown by its section label text.
 * Finds the nearest .space-y-2 container that has the label, then picks the option.
 */
export async function selectDropdownByLabel(
	page: Page,
	sectionLabel: string,
	optionLabel: string
): Promise<void> {
	const exactLabel = new RegExp(`^\\s*${sectionLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
	const label = page.locator('span.block.text-sm.font-medium', { hasText: exactLabel }).first();
	const section = label.locator(
		'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " space-y-2 ")][1]'
	);
	await selectDropdownOption(section, optionLabel);

	// Dropdown options may render outside the local field block. Pick the visible one globally.
	const option = page.getByRole('button', { name: optionLabel, exact: true }).last();
	await option.waitFor({ state: 'visible', timeout: 10_000 });
	await option.click({ force: true });
}

/**
 * Select a value from a SearchDropdown component.
 */
export async function selectSearchDropdownOption(
	scope: Locator,
	placeholder: string,
	optionLabel: string
): Promise<void> {
	const input = scope.getByPlaceholder(placeholder);
	await input.click();
	await input.fill('');
	await input.fill(optionLabel);

	const optionButtons = scope.locator('div.absolute').getByRole('button');
	await optionButtons.first().waitFor({ state: 'visible', timeout: 10_000 });

	const escaped = optionLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const prefixMatch = optionButtons.filter({
		hasText: new RegExp(`^${escaped}`)
	});

	if ((await prefixMatch.count()) > 0) {
		await prefixMatch.first().click();
		return;
	}

	await optionButtons.first().click();
}
