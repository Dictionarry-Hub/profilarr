import { test, expect } from '$flows/helpers/test.ts';
import { fixture } from '$flows/helpers/fixtureData.ts';
import { openEntity, openSidebarPage } from '$flows/helpers/nav.ts';
import { pageData } from '$flows/helpers/pageData.ts';
import { saveForm } from '$flows/helpers/forms.ts';
import type { Page } from '@playwright/test';

interface RegexPage {
	regularExpression: { name: string; description: string | null };
}

interface GeneralSettingsPage {
	tmdbSettings: { hasApiKey: boolean };
}

/** Open the new regular expression form and fill in a name and pattern */
async function startNewRegex(page: Page, name: string) {
	await openSidebarPage(page, 'Regular Expressions');
	await page.goto(`${new URL(page.url()).pathname}/new`);
	const main = page.getByRole('main');
	await main.getByRole('textbox', { name: /^Name/ }).fill(name);
	await main.getByRole('textbox', { name: /^Regular Expression/ }).fill('\\bProbe\\b');
}

test('saveForm follows an action redirect', async ({ page }) => {
	await startNewRegex(page, 'Saved Regex');
	const listPath = new URL(page.url()).pathname.replace(/\/new$/, '');

	const result = await saveForm(page, { button: 'Create' });

	expect(result.type).toBe('redirect');
	expect(new URL(page.url()).pathname).toBe(listPath);
	await expect(page.getByRole('main').getByText('Saved Regex', { exact: true })).toBeVisible();
});

test('saveForm follows redirectTo from a successful action', async ({ page }) => {
	const regex = fixture.regularExpression('Title Regex');
	await openEntity(page, 'Regular Expressions', regex.name);
	const entityPath = new URL(page.url()).pathname;
	await page.getByRole('main').getByRole('textbox', { name: 'Description' }).fill('Saved text');

	const result = await saveForm(page, { button: 'Save Changes' });

	expect(result.type).toBe('success');
	expect(new URL(page.url()).pathname, 'the form returns to the list').not.toBe(entityPath);
	const data = await pageData<RegexPage>(page, entityPath);
	expect(data.regularExpression.description).toBe('Saved text');
});

test('saveForm waits on a page that stays put', async ({ page }) => {
	await openSidebarPage(page, 'General');
	const settingsPath = new URL(page.url()).pathname;
	await page.getByRole('main').getByLabel('API Read Access Token').fill('flow-token');

	const result = await saveForm(page);

	expect(result.type).toBe('success');
	expect(new URL(page.url()).pathname).toBe(settingsPath);
	const data = await pageData<GeneralSettingsPage>(page);
	expect(data.tmdbSettings.hasApiKey).toBe(true);
});

test('saveForm fails with the app message when the action fails', async ({ page }) => {
	await startNewRegex(page, fixture.regularExpression('Title Regex').name);

	await expect(saveForm(page, { button: 'Create' })).rejects.toThrow(
		/failure \(400\).*already exists/
	);
});
