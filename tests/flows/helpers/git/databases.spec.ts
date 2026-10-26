import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, FIXTURES_NAME } from '$flows/helpers/core/test.ts';
import { fixture, fixturesSource } from '$flows/helpers/core/fixtureData.ts';
import {
	clonedRemote,
	fixturesRepo,
	publishChanges,
	pullDatabase,
	setClonedOrigin,
	setDeveloperAccess
} from '$flows/helpers/git/databases.ts';
import { saveForm } from '$flows/helpers/core/forms.ts';
import { openDatabase, openEntity } from '$flows/helpers/core/nav.ts';
import { pageData } from '$flows/helpers/core/pageData.ts';
import { regularExpressionPages } from '$flows/helpers/entities/regularExpressions.ts';
import { upstream } from '$flows/helpers/git/upstream.ts';

interface DatabaseSettingsPage {
	database: { hasPat: boolean; git_user_name: string | null; git_user_email: string | null };
}

const REGEX = fixture.regularExpression('Title Regex').name;

/** SQL for an upstream op that sets the regex's description */
function describeRegex(description: string): string {
	return `UPDATE regular_expressions SET description = '${description}' WHERE name = '${REGEX}';\n`;
}

/** The regex's stored description, read from its page on the current app */
async function regexDescription(page: Page): Promise<string | null> {
	await openEntity(page, 'Regular Expressions', REGEX);
	return (await regularExpressionPages.entity(page)).regularExpression.description;
}

/** Edit the regex's description and save it */
async function editRegex(page: Page, description: string): Promise<void> {
	await openEntity(page, 'Regular Expressions', REGEX);
	await page.getByRole('main').getByRole('textbox', { name: 'Description' }).fill(description);
	await saveForm(page, { button: 'Save Changes' });
}

/** The Changes tab once nothing is waiting to pull or publish */
const NOTHING_LEFT = /No changes to pull or publish right now|Nothing to ship/;

test.describe('clonedRemote', () => {
	test("reads the seeded clone's GitHub URL", async ({ app }) => {
		const remote = await clonedRemote(fixturesRepo(app));
		expect(remote.origin).toBe(fixturesSource.fixtures.repository);
		expect(remote.config).toContain('[remote "origin"]');
		expect(remote.config).toContain(fixturesSource.fixtures.repository);
	});
});

test.describe('setClonedOrigin', () => {
	test("changes a clone's origin", async ({ app }) => {
		await setClonedOrigin(fixturesRepo(app), 'https://example.com/changed');
		expect((await clonedRemote(fixturesRepo(app))).origin).toBe('https://example.com/changed');
	});

	test('makes a clone with that origin where none is', async ({ app }) => {
		const repo = join(fixturesRepo(app), 'deps/made');
		await setClonedOrigin(repo, 'https://example.com/made', { create: true });
		expect((await clonedRemote(repo)).origin).toBe('https://example.com/made');
	});
});

test.describe('setDeveloperAccess', () => {
	test('saves a token and a git author', async ({ page }) => {
		await setDeveloperAccess(page, { authorName: 'Ada', authorEmail: 'ada@localhost' });

		const { database } = await pageData<DatabaseSettingsPage>(page);
		expect(database).toMatchObject({
			hasPat: true,
			git_user_name: 'Ada',
			git_user_email: 'ada@localhost'
		});
	});
});

test.describe('pullDatabase', () => {
	test('brings in an upstream op, and the app compiles it', async ({ app, page }) => {
		await upstream(app).commitOp('8.describe-title-regex.sql', describeRegex('Pulled'), 'Describe');

		await openDatabase(page, FIXTURES_NAME);
		await pullDatabase(page);

		expect(await regexDescription(page)).toBe('Pulled');
	});
});

test.describe('publishChanges', () => {
	test('pushes a draft to the upstream as an op file', async ({ app, page }) => {
		await setDeveloperAccess(page);
		await editRegex(page, 'Published');

		await openDatabase(page, FIXTURES_NAME);
		const filename = await publishChanges(page, 'Describe Title Regex', { rows: [REGEX] });

		const origin = upstream(app);
		expect(origin.log()[0].subject).toBe('Describe Title Regex');
		expect(filename, 'the export names its op file').toBeTruthy();
		expect(origin.files('ops')).toContain(filename);
		expect(origin.show(`ops/${filename}`)).toContain('Published');
		await expect(page.getByRole('main').getByText(NOTHING_LEFT)).toBeVisible();
	});

	test('reaches a second install that pulls it', async ({ page, consumer }) => {
		await setDeveloperAccess(page);
		await editRegex(page, 'Released');
		await openDatabase(page, FIXTURES_NAME);
		await publishChanges(page, 'Release a description');

		await page.goto(consumer.url);
		await openDatabase(page, FIXTURES_NAME);
		await pullDatabase(page);

		expect(await regexDescription(page), 'the second install compiles the release').toBe(
			'Released'
		);
	});
});
