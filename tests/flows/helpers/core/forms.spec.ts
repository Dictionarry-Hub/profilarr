import { test, expect } from './test.ts';
import { fixture } from './fixtureData.ts';
import { newEntity, openEntity, openPage, openSidebarPage } from './nav.ts';
import { pageData } from './pageData.ts';
import { chooseOption, confirmDialog, deleteEntity, fillField, saveForm } from './forms.ts';
import { delayProfilePages } from '#flows/helpers/entities/delayProfiles.ts';
import { regularExpressionPages } from '#flows/helpers/entities/regularExpressions.ts';
import type { Page } from '@playwright/test';

interface RegexPage {
	regularExpression: { name: string; description: string | null };
}

interface RegexListPage {
	regularExpressions: { name: string }[];
}

interface GeneralSettingsPage {
	tmdbSettings: { hasApiKey: boolean };
}

/** Open the new regular expression form and fill in a name and pattern */
async function startNewRegex(page: Page, name: string) {
	await openSidebarPage(page, 'Regular Expressions');
	await openPage(page, `${new URL(page.url()).pathname}/new`);
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

test('deleteEntity deletes and returns to the list', async ({ page }) => {
	const regex = fixture.regularExpression('Unused Regex');
	await openEntity(page, 'Regular Expressions', regex.name);

	const listPath = new URL(page.url()).pathname.replace(/\/\d+$/, '');

	await deleteEntity(page);

	// Checked once, not retried: deleteEntity must only return once both are true
	expect(new URL(page.url()).pathname, 'the delete returns to the list').toBe(listPath);
	const data = await pageData<RegexListPage>(page, listPath);
	expect(data.regularExpressions.map((r) => r.name)).not.toContain(regex.name);
});

test('confirmDialog clicks the named button', async ({ page }) => {
	const regex = fixture.regularExpression('Unused Regex');
	await openEntity(page, 'Regular Expressions', regex.name);
	const entityPath = new URL(page.url()).pathname;
	await page.getByRole('main').getByRole('button', { name: 'Delete', exact: true }).click();

	await confirmDialog(page, 'Cancel');

	await expect(page.getByRole('dialog')).toHaveCount(0);
	expect(new URL(page.url()).pathname).toBe(entityPath);
});

test.describe('chooseOption', () => {
	test('picks from a plain dropdown whose options have descriptions', async ({ page }) => {
		await openEntity(page, 'Delay Profiles', fixture.delayProfile('Prefer Usenet').name);
		await chooseOption(page.getByRole('main'), 'Protocol Preference', 'Prefer Torrent');
	});

	test('waits for a short label when the button shows one', async ({ page }) => {
		await openEntity(page, 'Delay Profiles', fixture.delayProfile('Prefer Usenet').name);
		await chooseOption(page.getByRole('main'), 'Delay Unit', 'Hours', { shows: 'Show in hours' });
	});

	test('picks from a searchable dropdown', async ({ page }) => {
		await openEntity(page, 'Quality Profiles', fixture.qualityProfile('Radarr Profile').name);
		await chooseOption(page.getByRole('main'), 'Language', 'German');
	});

	test('fails when the dropdown has no such option', async ({ page }) => {
		await openEntity(page, 'Delay Profiles', fixture.delayProfile('Prefer Usenet').name);
		await expect(
			chooseOption(page.getByRole('main'), 'Protocol Preference', 'Carrier Pigeon')
		).rejects.toThrow('should offer Carrier Pigeon');
	});
});

test.describe('fillField', () => {
	test('finds a required field by its label without the star', async ({ page }) => {
		await newEntity(page, 'Regular Expressions', 'Blank');
		const main = page.getByRole('main');
		await fillField(main, 'Name', 'Filled Regex');
		await main.getByRole('textbox', { name: /^Regular Expression/ }).fill('\\bFilled\\b');
		await saveForm(page, { button: 'Create' });

		const names = (await regularExpressionPages.list(page)).map((regex) => regex.name);
		expect(names, 'the filled name should be stored').toContain('Filled Regex');
	});

	test('commits a number field with Tab', async ({ page }) => {
		const profile = fixture.delayProfile('Prefer Usenet');
		await openEntity(page, 'Delay Profiles', profile.name);
		await fillField(page.getByRole('main'), 'Torrent Delay (hours)', 3);
		await saveForm(page, { button: 'Save Changes' });

		const stored = (await delayProfilePages.list(page)).find((p) => p.name === profile.name);
		expect(stored?.torrent_delay, 'the delay should be stored in minutes').toBe(180);
	});

	test('fails when no field has the label', async ({ page }) => {
		await newEntity(page, 'Regular Expressions', 'Blank');
		await expect(fillField(page.getByRole('main'), 'Carrier Pigeon', 'coo')).rejects.toThrow(
			'The Carrier Pigeon field should be shown'
		);
	});
});
