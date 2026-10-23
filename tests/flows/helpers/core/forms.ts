/**
 * Save or delete through a form and wait until the app has really done it.
 *
 * App forms post to a SvelteKit form action (`<page>?/<name>`), either as an
 * enhanced form or with `fetch`, and get a JSON result back. The server has
 * written and recompiled before it answers, so waiting for that result is
 * exact. Waiting for the success alert isn't: alerts stay up for 8 seconds, so
 * an earlier one can match.
 *
 * A successful save ends in one of three ways:
 * - the action redirects (`type: 'redirect'`), and SvelteKit follows it.
 *   Creates and deletes do this.
 * - the action succeeds with `redirectTo`, and the form's own code goes there.
 *   Entity edit pages do this. Scoring and Qualities return their own page and
 *   stay on it.
 * - the action succeeds without `redirectTo`, and the page stays.
 *
 * Seeded apps have the post-save sync prompt off, so a save never stops at the
 * "sync now?" dialog.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { unflatten } from '$flows/helpers/core/pageData.ts';

export interface ActionResult {
	type: 'success' | 'failure' | 'redirect' | 'error';
	status?: number;
	/** What the action returned, decoded */
	data?: unknown;
	location?: string;
	error?: unknown;
}

interface ActionData {
	success?: boolean;
	error?: string;
	redirectTo?: string;
}

/**
 * Wait for the result of a form action posted from the current page: the one
 * named `name`, or any action when it's left out. Start waiting before the
 * click that submits, and await it after.
 */
export async function waitForAction(page: Page, name?: string): Promise<ActionResult> {
	const pagePath = new URL(page.url()).pathname;
	const response = await page.waitForResponse((response) => {
		if (response.request().method() !== 'POST') return false;
		const url = new URL(response.url());
		if (url.pathname !== pagePath) return false;
		return name === undefined || url.search === `?/${name}`;
	});
	const body = (await response.json()) as Omit<ActionResult, 'data'> & { data?: string };
	return { ...body, data: body.data === undefined ? undefined : unflatten(JSON.parse(body.data)) };
}

export interface SaveOptions {
	/** The submit button's name. Default "Save". */
	button?: string;
	/** The form action's name, when the page has several */
	action?: string;
	/** Where the button is, when the page has several with the same name. Default main. */
	within?: Locator;
}

/**
 * Click a form's submit button and wait for its action to succeed, then for
 * any redirect. Fails with the app's message when the save doesn't succeed.
 * Returns the action's result.
 */
export async function saveForm(page: Page, options: SaveOptions = {}): Promise<ActionResult> {
	const button = options.button ?? 'Save';
	return await test.step(
		`Save with ${button}`,
		async () => {
			const scope = options.within ?? page.getByRole('main');
			const save = scope.getByRole('button', { name: button, exact: true });
			await expect(save, `${button} should be enabled once the form changed`).toBeEnabled();

			const posted = waitForAction(page, options.action);
			await save.click();
			const result = await posted;

			await expectSucceeded(page, result, 'Saving');
			return result;
		},
		{ box: true }
	);
}

/**
 * Check an action's result: fail with the app's message unless it succeeded,
 * and wait for any redirect it asked for. `what` starts the error message.
 */
async function expectSucceeded(page: Page, result: ActionResult, what: string): Promise<void> {
	const data = (result.data ?? {}) as ActionData;
	if (result.type === 'failure' || result.type === 'error' || data.success === false) {
		const message = data.error ?? JSON.stringify(result.error ?? result.data);
		throw new Error(`${what} answered ${result.type} (${result.status}): ${message}`);
	}

	const location = result.type === 'redirect' ? result.location : data.redirectTo;
	if (location) {
		const target = new URL(location, page.url()).pathname;
		await expect(page, `${what} should go on to ${target}`).toHaveURL(
			(url) => url.pathname === target
		);
	}
}

/**
 * Wait for the open dialog and click one of its buttons. Dialogs have no
 * accessible name yet, so this relies on only one being open at a time.
 */
export async function confirmDialog(page: Page, button: string): Promise<void> {
	await test.step(
		`Confirm the dialog with ${button}`,
		async () => {
			const dialog = page.getByRole('dialog');
			await expect(dialog, 'A dialog should open').toBeVisible();
			await dialog.getByRole('button', { name: button, exact: true }).click();
		},
		{ box: true }
	);
}

export interface DeleteOptions {
	/** The page's delete button. Default "Delete". */
	button?: string;
	/** The dialog's confirm button. Default "Delete". */
	confirm?: string;
	/** The form action's name. Default "delete". */
	action?: string;
}

/**
 * Delete the open entity: click Delete, confirm the dialog, and wait for the
 * delete action to succeed and for any redirect, usually back to the list.
 * Fails with the app's message when the delete doesn't succeed.
 */
export async function deleteEntity(page: Page, options: DeleteOptions = {}): Promise<ActionResult> {
	const button = options.button ?? 'Delete';
	return await test.step(
		`Delete with ${button}`,
		async () => {
			const remove = page.getByRole('main').getByRole('button', { name: button, exact: true });
			await expect(remove, `${button} should be enabled`).toBeEnabled();
			await remove.click();

			const posted = waitForAction(page, options.action ?? 'delete');
			await confirmDialog(page, options.confirm ?? 'Delete');
			const result = await posted;

			await expectSucceeded(page, result, 'Deleting');
			return result;
		},
		{ box: true }
	);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface ChooseOptions {
	/**
	 * What the closed button shows once chosen, when it differs from the
	 * option's label: an option with a `shortLabel`, such as the delay unit's
	 * "Show in hours" for "Hours". Default the option's label.
	 */
	shows?: string;
}

/**
 * Choose an option in the dropdown labelled `label` inside `scope`, then wait
 * until its button shows the choice. Works for both dropdowns. Each one's
 * button is named "<label>: <current value>". A searchable dropdown
 * (`DropdownCombobox`) opens a listbox named `label` with option rows; a plain
 * one (`DropdownSelect`) shows its options as buttons. An option's name can
 * include its description, so an exact match wins, then a name starting with
 * the option.
 */
export async function chooseOption(
	scope: Locator,
	label: string,
	option: string,
	options: ChooseOptions = {}
): Promise<void> {
	await test.step(
		`Choose ${option} for ${label}`,
		async () => {
			const page = scope.page();
			const button = scope.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}: `) });
			await expect(button, `The ${label} dropdown should be shown`).toBeVisible();
			await button.click();

			const listbox = page.getByRole('listbox', { name: label, exact: true });
			const byName = (name: string | RegExp) =>
				listbox
					.getByRole('option', { name, exact: typeof name === 'string' })
					.or(page.getByRole('button', { name, exact: typeof name === 'string' }))
					.filter({ visible: true });
			const exact = byName(option);
			const prefixed = byName(new RegExp(`^${escapeRegExp(option)}(\\s|$)`));
			await expect(prefixed.first(), `The ${label} dropdown should offer ${option}`).toBeVisible();
			await ((await exact.count()) > 0 ? exact : prefixed).first().click();

			const shows = options.shows ?? option;
			await expect(
				scope.getByRole('button', { name: `${label}: ${shows}`, exact: true }),
				`The ${label} dropdown should show ${shows}`
			).toBeVisible();
		},
		{ box: true }
	);
}
