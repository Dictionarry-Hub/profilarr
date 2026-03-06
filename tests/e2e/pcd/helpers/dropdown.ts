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
	// Click the trigger button within this scope
	await scope.getByRole('button').first().click();

	// Click the option — use last() because the trigger button may also match the text
	// but the dropdown option always appears after it in DOM order
	await scope.getByRole('button', { name: optionLabel, exact: true }).last().click();
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
	const section = page.locator('.space-y-2', { hasText: sectionLabel }).first();
	await selectDropdownOption(section, optionLabel);
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
