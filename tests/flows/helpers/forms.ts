/**
 * Save a form and wait until the app has really saved it.
 *
 * App forms post to a SvelteKit form action (`<page>?/<name>`), either as an
 * enhanced form or with `fetch`, and get a JSON result back. Waiting for that
 * result is exact. Waiting for the success alert isn't: alerts stay up for 8
 * seconds, so an earlier one can match.
 *
 * A successful save ends in one of three ways:
 * - the action redirects (`type: 'redirect'`), and SvelteKit follows it;
 * - the action succeeds with `redirectTo`, and the form's own code goes there;
 * - the action succeeds, and the page stays.
 *
 * Seeded apps have the post-save sync prompt off, so a save never stops at the
 * "sync now?" dialog.
 */

import { expect, test, type Page } from '@playwright/test';
import { unflatten } from '$flows/helpers/pageData.ts';

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
			const save = page.getByRole('main').getByRole('button', { name: button, exact: true });
			await expect(save, `${button} should be enabled once the form changed`).toBeEnabled();

			const posted = waitForAction(page, options.action);
			await save.click();
			const result = await posted;

			const data = (result.data ?? {}) as ActionData;
			if (result.type === 'failure' || result.type === 'error' || data.success === false) {
				const message = data.error ?? JSON.stringify(result.error ?? result.data);
				throw new Error(`Saving answered ${result.type} (${result.status}): ${message}`);
			}

			const location = result.type === 'redirect' ? result.location : data.redirectTo;
			if (location) {
				const target = new URL(location, page.url()).pathname;
				await expect(page, `Saving should go on to ${target}`).toHaveURL(
					(url) => url.pathname === target
				);
			}
			return result;
		},
		{ box: true }
	);
}
