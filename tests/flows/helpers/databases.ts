/**
 * Linked database helpers: developer access, pulling and publishing. Each
 * works through the UI on the database's own pages and waits for the form
 * action behind it, so a scenario continues once the app has finished.
 *
 * Pulling and publishing reach the test's local upstream (helpers/upstream.ts).
 */

import { expect, test, type Page } from '@playwright/test';
import { FIXTURES_NAME, FLOWS_TOKEN } from '$flows/harness/seed.ts';
import { saveForm, waitForAction, type ActionResult } from '$flows/helpers/forms.ts';
import { openDatabase, openTab } from '$flows/helpers/nav.ts';

export interface DeveloperOptions {
	/** The database to open. Default the fixtures database. */
	database?: string;
	/** Git author for published commits */
	authorName?: string;
	authorEmail?: string;
}

/**
 * Give a database developer access, as its developer would: save a personal
 * access token and a git author on its Settings tab. Edits then become base
 * drafts that can be published from Changes. The token is FLOWS_TOKEN, the
 * only one whose pushes reach the local upstream.
 */
export async function setDeveloperAccess(
	page: Page,
	options: DeveloperOptions = {}
): Promise<void> {
	const {
		database = FIXTURES_NAME,
		authorName = 'Flow Developer',
		authorEmail = 'developer@localhost'
	} = options;
	await test.step(
		`Give ${database} developer access`,
		async () => {
			await openDatabase(page, database);
			await openTab(page, 'Settings');
			const main = page.getByRole('main');
			await main.getByLabel(/^Personal Access Token/).fill(FLOWS_TOKEN);
			// The author fields only show once a token is typed
			await main.getByLabel(/^Git Author Name/).fill(authorName);
			await main.getByLabel(/^Git Author Email/).fill(authorEmail);
			await saveForm(page, { action: 'update' });
		},
		{ box: true }
	);
}

/** Fail with the app's message unless an action's result reports success */
function expectSuccess(result: ActionResult, what: string): void {
	const data = (result.data ?? {}) as { success?: boolean; error?: string };
	if (result.type !== 'success' || data.success === false) {
		const message = data.error ?? JSON.stringify(result.error ?? result.data);
		throw new Error(`${what} answered ${result.type} (${result.status}): ${message}`);
	}
}

/** Open the Changes tab unless the page is already on it */
async function onChanges(page: Page): Promise<void> {
	if (!new URL(page.url()).pathname.endsWith('/changes')) await openTab(page, 'Changes');
}

/**
 * Pull incoming commits on the open database's Changes tab and wait until
 * the tab has reloaded with nothing left to pull. Fails if there is nothing
 * to pull, or with the app's message if the pull fails.
 */
export async function pullDatabase(page: Page): Promise<void> {
	await test.step(
		'Pull incoming commits',
		async () => {
			await onChanges(page);
			const main = page.getByRole('main');
			// The button counts the commits, and reads "Pulling..." until the tab reloads
			const pull = main.getByRole('button', { name: /^Pull(ing\.\.\.| \d+ commits?)$/ });
			await expect(pull, 'Changes should offer incoming commits to pull').toBeVisible();

			const pulled = waitForAction(page, 'pull');
			await pull.click();
			expectSuccess(await pulled, 'Pulling');
			await expect(pull, 'Changes should have nothing left to pull').toHaveCount(0);
		},
		{ box: true }
	);
}

export interface PublishOptions {
	/** Rows to select by name, e.g. an entity's name. Default all of them. */
	rows?: string[];
}

/**
 * Publish draft changes from the open database's Changes tab: select them,
 * type the commit message, preview, and approve the export. Fails with the
 * preview's errors or the app's message. Returns the published op file's name.
 */
export async function publishChanges(
	page: Page,
	message: string,
	options: PublishOptions = {}
): Promise<string | undefined> {
	return await test.step(
		`Publish "${message}"`,
		async () => {
			await onChanges(page);
			const main = page.getByRole('main');

			if (options.rows) {
				for (const name of options.rows) {
					const boxes = main.getByRole('checkbox', { name: `Select ${name}`, exact: true });
					await expect(boxes.first(), `Changes should list a draft for ${name}`).toBeVisible();
					for (const box of await boxes.all()) await box.check();
				}
			} else {
				const all = main.getByRole('button', { name: /^Select all \(\d+\)$/ });
				await expect(all, 'Changes should list drafts to publish').toBeVisible();
				await all.click();
			}

			// The message box has no label, only a placeholder
			await main.getByPlaceholder('Commit message...').fill(message);

			const previewed = waitForAction(page, 'preview');
			await main.getByRole('button', { name: 'Preview export', exact: true }).click();
			const preview = await previewed;
			expectSuccess(preview, 'Previewing');
			const checks = (preview.data as { preview?: { ok: boolean; errors: string[] } }).preview;
			if (!checks?.ok) {
				throw new Error(`The export preview failed: ${checks?.errors.join(' ') ?? 'no preview'}`);
			}

			const dialog = page.getByRole('dialog', { name: 'Export preview' });
			await expect(dialog, 'The export preview should open').toBeVisible();
			const committed = waitForAction(page, 'commit');
			await dialog.getByRole('button', { name: 'Approve & Export', exact: true }).click();
			const result = await committed;
			expectSuccess(result, 'Publishing');
			await expect(dialog, 'The export preview should close once published').toBeHidden();
			return (result.data as { filename?: string }).filename;
		},
		{ box: true }
	);
}
