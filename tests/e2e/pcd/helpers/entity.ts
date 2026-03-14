/**
 * Helpers for creating and editing entities through the UI.
 * Each entity type has its own functions since the forms differ.
 *
 * Selector notes (from inspecting the actual components):
 * - Name fields use raw <label> with "Name <span>*</span>" → accessible text "Name *" (with space)
 * - Description fields use MarkdownInput; helper handles both edit and preview modes
 * - Save button in edit mode reads "Save Changes" (not "Save")
 * - Regex pattern label is "Regular Expression *" — use #pattern id instead
 * - Entity list rows are <tr> with onRowClick, not <a> links
 */
import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { fillMarkdownInput } from './markdown';
import { isIconCheckboxCheckedByLabel, setIconCheckboxByLabel } from './checkbox';
import { selectSearchDropdownOption } from './dropdown';

// ---------------------------------------------------------------------------
// Custom Formats
// ---------------------------------------------------------------------------

/**
 * Navigate to a custom format's general page by searching for it.
 */
export async function goToCustomFormat(
	page: Page,
	databaseId: number,
	name: string
): Promise<void> {
	await page.goto(`/custom-formats/${databaseId}`);
	await page.waitForLoadState('networkidle');

	// Search for the CF
	await page.getByPlaceholder(/search/i).fill(name);
	await page.waitForTimeout(500); // debounce

	const tableRow = page.locator('table tbody tr', { hasText: name }).first();
	if (await tableRow.isVisible()) {
		await tableRow.click();
	} else {
		await page
			.locator(`a[href^="/custom-formats/${databaseId}/"]`, { hasText: name })
			.first()
			.click();
	}
	await page.waitForURL(/\/custom-formats\/\d+\/\d+/, { timeout: 15_000 });
	await page.waitForLoadState('networkidle');
}

/**
 * Update a custom format's description field.
 * Assumes we're already on the CF general page.
 * Description uses MarkdownInput.
 */
export async function updateCfDescription(page: Page, description: string): Promise<void> {
	await fillMarkdownInput(page, 'description', description);

	await page.getByRole('button', { name: 'Save Changes' }).click();
	await page.waitForLoadState('networkidle');
}

/**
 * Update a custom format's name field.
 * Assumes we're already on the CF general page.
 */
export async function updateCfName(page: Page, name: string): Promise<void> {
	await page.locator('#name').fill(name);

	await page.getByRole('button', { name: 'Save Changes' }).click();
	await page.waitForLoadState('networkidle');
}

/**
 * Navigate to a custom format's conditions page.
 */
export async function goToCustomFormatConditions(
	page: Page,
	databaseId: number,
	name: string
): Promise<void> {
	await page.setViewportSize({ width: 1920, height: 1200 });
	await goToCustomFormat(page, databaseId, name);
	if (!/\/custom-formats\/\d+\/\d+/.test(page.url())) {
		await page.waitForURL(/\/custom-formats\/\d+\/\d+/, { timeout: 15_000 });
	}
	const match = page.url().match(/\/custom-formats\/(\d+)\/(\d+)/);
	if (!match) {
		throw new Error(`Unexpected custom format URL: ${page.url()}`);
	}
	const conditionsUrl = `/custom-formats/${match[1]}/${match[2]}/conditions`;
	await page.goto(conditionsUrl);
	await page.waitForLoadState('networkidle');
}

/**
 * Navigate to a custom format's general page.
 */
export async function goToCustomFormatGeneral(
	page: Page,
	databaseId: number,
	name: string
): Promise<void> {
	await goToCustomFormat(page, databaseId, name);
	if (!/\/custom-formats\/\d+\/\d+/.test(page.url())) {
		await page.waitForURL(/\/custom-formats\/\d+\/\d+/, { timeout: 15_000 });
	}
	const match = page.url().match(/\/custom-formats\/(\d+)\/(\d+)/);
	if (!match) {
		throw new Error(`Unexpected custom format URL: ${page.url()}`);
	}
	const generalUrl = `/custom-formats/${match[1]}/${match[2]}/general`;
	await page.goto(generalUrl);
	await page.waitForLoadState('networkidle');
}

async function findConditionCardByName(page: Page, conditionName: string): Promise<Locator> {
	const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();
	const target = normalize(conditionName);

	// Support both old and new markup variants.
	const inputs = page.locator('input[id^="condition-name-"], input[placeholder="Condition name"]');

	// Conditions can render a little after navigation/data hydration.
	await inputs.first().waitFor({ state: 'visible', timeout: 15_000 });

	const count = await inputs.count();
	for (let i = 0; i < count; i++) {
		const input = inputs.nth(i);
		const value = normalize(await input.inputValue());
		if (value === target) {
			return input.locator('xpath=ancestor::div[contains(@class,"relative")]');
		}
	}

	// Fallback: match a visible card by text content.
	const fallbackCard = page
		.locator('div.relative')
		.filter({ has: page.getByText(conditionName, { exact: true }) })
		.first();
	if (await fallbackCard.isVisible()) {
		return fallbackCard;
	}

	const seenNames: string[] = [];
	for (let i = 0; i < count; i++) {
		seenNames.push((await inputs.nth(i).inputValue()).trim());
	}
	throw new Error(
		`Condition "${conditionName}" not found. Visible conditions: ${seenNames.join(', ')}`
	);
}

export async function hasConditionByName(page: Page, conditionName: string): Promise<boolean> {
	const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();
	const target = normalize(conditionName);
	const inputs = page.locator('input[id^="condition-name-"], input[placeholder="Condition name"]');
	const count = await inputs.count();
	for (let i = 0; i < count; i++) {
		const input = inputs.nth(i);
		const value = normalize(await input.inputValue());
		if (value === target) {
			return true;
		}
	}
	return false;
}

export async function removeConditionByName(page: Page, conditionName: string): Promise<void> {
	const card = await findConditionCardByName(page, conditionName);
	await card.getByTitle('Remove condition').click();
}

/**
 * Update a condition's name by condition name.
 */
export async function updateConditionNameByName(
	page: Page,
	conditionName: string,
	newName: string
): Promise<void> {
	const card = await findConditionCardByName(page, conditionName);
	await card.locator('input[placeholder="Condition name"]').fill(newName);
}

/**
 * Update a condition's dropdown value by condition name.
 * Intended for enum-based types like resolution/source.
 */
export async function updateConditionValueByName(
	page: Page,
	conditionName: string,
	optionLabel: string
): Promise<void> {
	const card = await findConditionCardByName(page, conditionName);
	await selectSearchDropdownOption(card, 'Select value...', optionLabel);
}

/**
 * Update a condition's pattern value by condition name.
 */
export async function updateConditionPatternByName(
	page: Page,
	conditionName: string,
	patternLabel: string
): Promise<void> {
	const card = await findConditionCardByName(page, conditionName);
	await selectSearchDropdownOption(card, 'Select pattern...', patternLabel);
}

/**
 * Update a condition's language value by condition name.
 */
export async function updateConditionLanguageByName(
	page: Page,
	conditionName: string,
	languageLabel: string
): Promise<void> {
	const card = await findConditionCardByName(page, conditionName);
	await selectSearchDropdownOption(card, 'Select language...', languageLabel);
}

/**
 * Update a condition's type by condition name.
 */
export async function updateConditionTypeByName(
	page: Page,
	conditionName: string,
	typeLabel: string
): Promise<void> {
	const card = await findConditionCardByName(page, conditionName);
	await selectSearchDropdownOption(card, 'Select type...', typeLabel);
}

/**
 * Read a condition's current dropdown value label.
 */
export async function getConditionValueByName(page: Page, conditionName: string): Promise<string> {
	const card = await findConditionCardByName(page, conditionName);
	const input = card.getByPlaceholder('Select value...');
	return (await input.inputValue()).trim();
}

/**
 * Read a condition's current pattern label.
 */
export async function getConditionPatternByName(
	page: Page,
	conditionName: string
): Promise<string> {
	const card = await findConditionCardByName(page, conditionName);
	const input = card.getByPlaceholder('Select pattern...');
	return (await input.inputValue()).trim();
}

/**
 * Read a condition's current language label.
 */
export async function getConditionLanguageByName(
	page: Page,
	conditionName: string
): Promise<string> {
	const card = await findConditionCardByName(page, conditionName);
	const input = card.getByPlaceholder('Select language...');
	return (await input.inputValue()).trim();
}

/**
 * Read a condition's current type label.
 */
export async function getConditionTypeByName(page: Page, conditionName: string): Promise<string> {
	const card = await findConditionCardByName(page, conditionName);
	const input = card.getByPlaceholder('Select type...');
	return (await input.inputValue()).trim();
}

/**
 * Read whether a condition is required.
 */
export async function getConditionRequiredByName(
	page: Page,
	conditionName: string
): Promise<boolean> {
	const card = await findConditionCardByName(page, conditionName);
	const toggle = card.getByRole('switch', { name: 'Required' });
	return (await toggle.getAttribute('aria-checked')) === 'true';
}

/**
 * Set a condition's required toggle.
 */
export async function setConditionRequiredByName(
	page: Page,
	conditionName: string,
	enabled: boolean
): Promise<void> {
	const card = await findConditionCardByName(page, conditionName);
	const toggle = card.getByRole('switch', { name: 'Required' });
	const current = (await toggle.getAttribute('aria-checked')) === 'true';
	if (current !== enabled) {
		await clickConditionToggle(toggle);
	}
}

/**
 * Read whether a condition is negated.
 */
export async function getConditionNegateByName(
	page: Page,
	conditionName: string
): Promise<boolean> {
	const card = await findConditionCardByName(page, conditionName);
	const toggle = card.getByRole('switch', { name: 'Negate' });
	return (await toggle.getAttribute('aria-checked')) === 'true';
}

/**
 * Set a condition's negate toggle.
 */
export async function setConditionNegateByName(
	page: Page,
	conditionName: string,
	enabled: boolean
): Promise<void> {
	const card = await findConditionCardByName(page, conditionName);
	const toggle = card.getByRole('switch', { name: 'Negate' });
	const current = (await toggle.getAttribute('aria-checked')) === 'true';
	if (current !== enabled) {
		await clickConditionToggle(toggle);
	}
}

async function clickConditionToggle(button: Locator): Promise<void> {
	await button.scrollIntoViewIfNeeded();
	try {
		await button.click();
	} catch {
		await button.click({ force: true });
	}
}

/**
 * Read a condition's current arr type ("all", "radarr", "sonarr", "none").
 */
export async function getConditionArrTypeByName(
	page: Page,
	conditionName: string
): Promise<string> {
	const card = await findConditionCardByName(page, conditionName);
	const radarrEnabled =
		(await card.getByRole('switch', { name: 'Radarr' }).getAttribute('aria-checked')) === 'true';
	const sonarrEnabled =
		(await card.getByRole('switch', { name: 'Sonarr' }).getAttribute('aria-checked')) === 'true';

	if (radarrEnabled && sonarrEnabled) return 'all';
	if (radarrEnabled) return 'radarr';
	if (sonarrEnabled) return 'sonarr';
	return 'none';
}

/**
 * Set a condition's arr type.
 */
export async function setConditionArrTypeByName(
	page: Page,
	conditionName: string,
	arrType: 'all' | 'radarr' | 'sonarr'
): Promise<void> {
	const card = await findConditionCardByName(page, conditionName);
	const radarrToggle = card.getByRole('switch', { name: 'Radarr' });
	const sonarrToggle = card.getByRole('switch', { name: 'Sonarr' });

	const targetRadarr = arrType === 'all' || arrType === 'radarr';
	const targetSonarr = arrType === 'all' || arrType === 'sonarr';

	const currentRadarr = (await radarrToggle.getAttribute('aria-checked')) === 'true';
	const currentSonarr = (await sonarrToggle.getAttribute('aria-checked')) === 'true';

	if (currentRadarr !== targetRadarr) {
		await clickConditionToggle(radarrToggle);
	}
	if (currentSonarr !== targetSonarr) {
		await clickConditionToggle(sonarrToggle);
	}
}

/**
 * Update a condition's size (GB) values.
 */
export async function setConditionSizeByName(
	page: Page,
	conditionName: string,
	input: { minGB?: number | null; maxGB?: number | null }
): Promise<void> {
	const card = await findConditionCardByName(page, conditionName);
	if (input.minGB !== undefined) {
		const minInput = card.getByPlaceholder('Min GB');
		await minInput.fill(input.minGB == null ? '' : String(input.minGB));
		await minInput.blur();
	}
	if (input.maxGB !== undefined) {
		const maxInput = card.getByPlaceholder('Max GB');
		await maxInput.fill(input.maxGB == null ? '' : String(input.maxGB));
		await maxInput.blur();
	}
}

/**
 * Read a condition's size (GB) values.
 */
export async function getConditionSizeByName(
	page: Page,
	conditionName: string
): Promise<{ minGB: number | null; maxGB: number | null }> {
	const card = await findConditionCardByName(page, conditionName);
	const minValue = await card.getByPlaceholder('Min GB').inputValue();
	const maxValue = await card.getByPlaceholder('Max GB').inputValue();
	return {
		minGB: minValue.trim() === '' ? null : Number(minValue),
		maxGB: maxValue.trim() === '' ? null : Number(maxValue)
	};
}

/**
 * Update a condition's year values.
 */
export async function setConditionYearByName(
	page: Page,
	conditionName: string,
	input: { minYear?: number | null; maxYear?: number | null }
): Promise<void> {
	const card = await findConditionCardByName(page, conditionName);
	if (input.minYear !== undefined) {
		const minInput = card.getByPlaceholder('Min Year');
		await minInput.fill(input.minYear == null ? '' : String(input.minYear));
		await minInput.blur();
	}
	if (input.maxYear !== undefined) {
		const maxInput = card.getByPlaceholder('Max Year');
		await maxInput.fill(input.maxYear == null ? '' : String(input.maxYear));
		await maxInput.blur();
	}
}

/**
 * Read a condition's year values.
 */
export async function getConditionYearByName(
	page: Page,
	conditionName: string
): Promise<{ minYear: number | null; maxYear: number | null }> {
	const card = await findConditionCardByName(page, conditionName);
	const minValue = await card.getByPlaceholder('Min Year').inputValue();
	const maxValue = await card.getByPlaceholder('Max Year').inputValue();
	return {
		minYear: minValue.trim() === '' ? null : Number(minValue),
		maxYear: maxValue.trim() === '' ? null : Number(maxValue)
	};
}

/**
 * Add a new enum-based condition (e.g., Resolution, Source).
 */
export async function addEnumCondition(
	page: Page,
	input: { name: string; typeLabel: string; valueLabel: string }
): Promise<void> {
	await page.getByRole('button', { name: 'Add Condition' }).click();

	const confirmButton = page.getByTitle('Confirm condition').last();
	const card = confirmButton.locator('xpath=ancestor::div[contains(@class,"relative")]');

	await card.locator('input[placeholder="Condition name"]').fill(input.name);

	await selectSearchDropdownOption(card, 'Select type...', input.typeLabel);

	await selectSearchDropdownOption(card, 'Select value...', input.valueLabel);

	await page.getByTitle('Confirm condition').last().click();
}

/**
 * Add a new pattern-based condition (e.g., Release Title, Release Group).
 */
export async function addPatternCondition(
	page: Page,
	input: { name: string; typeLabel: string; patternLabel: string }
): Promise<void> {
	await page.getByRole('button', { name: 'Add Condition' }).click();

	const confirmButton = page.getByTitle('Confirm condition').last();
	const card = confirmButton.locator('xpath=ancestor::div[contains(@class,"relative")]');

	await card.locator('input[placeholder="Condition name"]').fill(input.name);

	await selectSearchDropdownOption(card, 'Select type...', input.typeLabel);

	await selectSearchDropdownOption(card, 'Select pattern...', input.patternLabel);

	await page.getByTitle('Confirm condition').last().click();
}

/**
 * Add a new language condition.
 */
export async function addLanguageCondition(
	page: Page,
	input: { name: string; languageLabel: string }
): Promise<void> {
	await page.getByRole('button', { name: 'Add Condition' }).click();

	const confirmButton = page.getByTitle('Confirm condition').last();
	const card = confirmButton.locator('xpath=ancestor::div[contains(@class,"relative")]');

	await card.locator('input[placeholder="Condition name"]').fill(input.name);

	await selectSearchDropdownOption(card, 'Select type...', 'Language');

	await selectSearchDropdownOption(card, 'Select language...', input.languageLabel);

	await page.getByTitle('Confirm condition').last().click();
}

/**
 * Add a new size condition (min/max GB).
 */
export async function addSizeCondition(
	page: Page,
	input: { name: string; minGB?: number; maxGB?: number }
): Promise<void> {
	await page.getByRole('button', { name: 'Add Condition' }).click();

	const confirmButton = page.getByTitle('Confirm condition').last();
	const card = confirmButton.locator('xpath=ancestor::div[contains(@class,"relative")]');

	await card.locator('input[placeholder="Condition name"]').fill(input.name);

	await selectSearchDropdownOption(card, 'Select type...', 'Size');

	if (input.minGB !== undefined) {
		const minInput = card.getByPlaceholder('Min GB');
		await minInput.fill(String(input.minGB));
		await minInput.blur();
	}
	if (input.maxGB !== undefined) {
		const maxInput = card.getByPlaceholder('Max GB');
		await maxInput.fill(String(input.maxGB));
		await maxInput.blur();
	}

	await page.getByTitle('Confirm condition').last().click();
}

/**
 * Add a new year condition (min/max year).
 */
export async function addYearCondition(
	page: Page,
	input: { name: string; minYear?: number; maxYear?: number }
): Promise<void> {
	await page.getByRole('button', { name: 'Add Condition' }).click();

	const confirmButton = page.getByTitle('Confirm condition').last();
	const card = confirmButton.locator('xpath=ancestor::div[contains(@class,"relative")]');

	await card.locator('input[placeholder="Condition name"]').fill(input.name);

	await selectSearchDropdownOption(card, 'Select type...', 'Year');

	if (input.minYear !== undefined) {
		const minInput = card.getByPlaceholder('Min Year');
		await minInput.fill(String(input.minYear));
		await minInput.blur();
	}
	if (input.maxYear !== undefined) {
		const maxInput = card.getByPlaceholder('Max Year');
		await maxInput.fill(String(input.maxYear));
		await maxInput.blur();
	}

	await page.getByTitle('Confirm condition').last().click();
}

/**
 * Save changes on the conditions page.
 */
export async function saveConditionChanges(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Save Changes' }).click();
	await page.waitForLoadState('networkidle');
}

/**
 * Read the current "Include In Rename" value.
 */
export async function getCfIncludeInRename(page: Page): Promise<boolean> {
	return await isIconCheckboxCheckedByLabel(page, 'Include In Rename');
}

/**
 * Update the "Include In Rename" toggle.
 * Assumes we're already on the CF general page.
 */
export async function updateCfIncludeInRename(page: Page, enabled: boolean): Promise<void> {
	await setIconCheckboxByLabel(page, 'Include In Rename', enabled);

	await page.getByRole('button', { name: 'Save Changes' }).click();
	await page.waitForLoadState('networkidle');
}

/**
 * Read the current value of a CF field on the general page.
 * Use the element id (e.g. 'name', 'description').
 */
export async function getCfFieldValue(page: Page, id: string): Promise<string> {
	return await page.locator(`#${id}`).inputValue();
}

/**
 * Add a tag to the custom format general page.
 * Assumes we're already on the CF general page.
 */
export async function addCfTag(page: Page, tag: string): Promise<void> {
	const input = page.locator('#tags-input');
	await input.fill(tag);
	await input.press('Enter');
}

/**
 * Remove a tag from the custom format general page.
 */
export async function removeCfTag(page: Page, tag: string): Promise<void> {
	const container = page
		.locator('#tags-input')
		.locator('xpath=ancestor::div[contains(@class,"flex")]');
	const tagRow = container.locator('span', { hasText: tag }).first();
	await tagRow.getByRole('button', { name: 'Remove tag' }).click();
}

// ---------------------------------------------------------------------------
// Regular Expressions
// ---------------------------------------------------------------------------

export async function goToRegex(page: Page, databaseId: number, name: string): Promise<void> {
	await page.goto(`/regular-expressions/${databaseId}`);
	await page.waitForLoadState('networkidle');

	await page.getByPlaceholder(/search/i).fill(name);
	await page.waitForTimeout(500);

	await page.locator('table tbody tr', { hasText: name }).first().click();
	await page.waitForLoadState('networkidle');
}

/**
 * Update a regex pattern. The textarea has id="pattern".
 */
export async function updateRegexPattern(page: Page, pattern: string): Promise<void> {
	await page.locator('#pattern').fill(pattern);

	await page.getByRole('button', { name: 'Save Changes' }).click();
	await page.waitForLoadState('networkidle');
}

/**
 * Update a regex description. Uses MarkdownInput.
 */
export async function updateRegexDescription(page: Page, description: string): Promise<void> {
	await fillMarkdownInput(page, 'description', description);

	await page.getByRole('button', { name: 'Save Changes' }).click();
	await page.waitForLoadState('networkidle');
}

// ---------------------------------------------------------------------------
// Delay Profiles
// ---------------------------------------------------------------------------

export async function goToDelayProfile(
	page: Page,
	databaseId: number,
	name: string
): Promise<void> {
	await page.goto(`/delay-profiles/${databaseId}`);
	await page.waitForLoadState('networkidle');

	await page.getByPlaceholder(/search/i).fill(name);
	await page.waitForTimeout(500);

	await page.locator('table tbody tr', { hasText: name }).first().click();
	await page.waitForLoadState('networkidle');
}

// ---------------------------------------------------------------------------
// Quality Profiles
// ---------------------------------------------------------------------------

async function clickQualityProfileListItem(
	page: Page,
	databaseId: number,
	name?: string
): Promise<void> {
	const tableRow = name
		? page.locator('table tbody tr', { hasText: name }).first()
		: page.locator('table tbody tr').first();
	const cardLink = name
		? page.locator(`a[href^="/quality-profiles/${databaseId}/"]`, { hasText: name }).first()
		: page.locator(`a[href^="/quality-profiles/${databaseId}/"]`).first();

	if (await tableRow.count()) {
		await expect(tableRow).toBeVisible();
		await tableRow.click();
		return;
	}

	await expect(cardLink).toBeVisible();
	await cardLink.click();
}

/**
 * Navigate to a quality profile's general page by searching for it.
 */
export async function goToQualityProfile(
	page: Page,
	databaseId: number,
	name: string
): Promise<void> {
	await page.goto(`/quality-profiles/${databaseId}`);
	await page.waitForLoadState('networkidle');

	await page.getByPlaceholder(/search/i).fill(name);
	await page.waitForTimeout(500);

	await clickQualityProfileListItem(page, databaseId, name);
	await page.waitForURL(/\/quality-profiles\/\d+\/\d+\/general/, { timeout: 15_000 });
	await page.waitForLoadState('networkidle');
}

/**
 * Navigate to a quality profile's general tab.
 */
export async function goToQualityProfileGeneral(
	page: Page,
	databaseId: number,
	name: string
): Promise<void> {
	await goToQualityProfile(page, databaseId, name);
	if (!/\/quality-profiles\/\d+\/\d+\/general/.test(page.url())) {
		const match = page.url().match(/\/quality-profiles\/(\d+)\/(\d+)/);
		if (!match) {
			throw new Error(`Unexpected quality profile URL: ${page.url()}`);
		}
		await page.goto(`/quality-profiles/${match[1]}/${match[2]}/general`);
		await page.waitForLoadState('networkidle');
	}
}

/**
 * Navigate to a quality profile's scoring tab.
 */
export async function goToQualityProfileScoring(
	page: Page,
	databaseId: number,
	name: string
): Promise<void> {
	await goToQualityProfile(page, databaseId, name);
	if (!/\/quality-profiles\/\d+\/\d+\/scoring/.test(page.url())) {
		const match = page.url().match(/\/quality-profiles\/(\d+)\/(\d+)/);
		if (!match) {
			throw new Error(`Unexpected quality profile URL: ${page.url()}`);
		}
		await page.goto(`/quality-profiles/${match[1]}/${match[2]}/scoring`);
		await page.waitForLoadState('networkidle');
	}
}

/**
 * Navigate to a quality profile's qualities tab.
 */
export async function goToQualityProfileQualities(
	page: Page,
	databaseId: number,
	name: string
): Promise<void> {
	await goToQualityProfile(page, databaseId, name);
	if (!/\/quality-profiles\/\d+\/\d+\/qualities/.test(page.url())) {
		const match = page.url().match(/\/quality-profiles\/(\d+)\/(\d+)/);
		if (!match) {
			throw new Error(`Unexpected quality profile URL: ${page.url()}`);
		}
		await page.goto(`/quality-profiles/${match[1]}/${match[2]}/qualities`);
		await page.waitForLoadState('networkidle');
	}
}

/**
 * Open the first quality profile in the list and return its current name.
 */
export async function openFirstQualityProfileGeneral(
	page: Page,
	databaseId: number
): Promise<string> {
	await page.goto(`/quality-profiles/${databaseId}`);
	await page.waitForLoadState('networkidle');

	await clickQualityProfileListItem(page, databaseId);
	await page.waitForURL(/\/quality-profiles\/\d+\/\d+\/general/, { timeout: 15_000 });
	await page.waitForLoadState('networkidle');

	return (await page.locator('#name').inputValue()).trim();
}

/**
 * Update quality profile description.
 */
export async function updateQpDescription(page: Page, description: string): Promise<void> {
	await fillMarkdownInput(page, 'description', description);
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');
}

/**
 * Update quality profile name.
 */
export async function updateQpName(page: Page, name: string): Promise<void> {
	await page.locator('#name').fill(name);
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForLoadState('networkidle');
}

/**
 * Add a tag on quality profile general page.
 */
export async function addQpTag(page: Page, tag: string): Promise<void> {
	const input = page.locator('#tags-input');
	await input.fill(tag);
	await input.press('Enter');
}

/**
 * Remove a tag on quality profile general page.
 */
export async function removeQpTag(page: Page, tag: string): Promise<void> {
	const container = page
		.locator('#tags-input')
		.locator('xpath=ancestor::div[contains(@class,"flex")]');
	const tagRow = container.locator('span', { hasText: tag }).first();
	await tagRow.getByRole('button', { name: 'Remove tag' }).click();
}
