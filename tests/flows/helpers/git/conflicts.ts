/**
 * A linked database's Conflicts tab: a typed reader for what it lists, and
 * the Align and Override buttons on each row.
 *
 * The tab lists every user op whose latest compile ended conflicted. With the
 * Align and Override strategies the app resolves conflicts itself while it
 * compiles, so the tab is empty once a pull returns. With Ask, the rows stay
 * until the user resolves each one. The route doesn't export its row type, so
 * it's declared here with the same shape.
 */

import { expect, test, type Page } from '@playwright/test';
import { FIXTURES_NAME } from '$flows/harness/seed.ts';
import { waitForAction, type ActionResult } from '$flows/helpers/core/forms.ts';
import { openDatabase, openTab } from '$flows/helpers/core/nav.ts';
import { pageData } from '$flows/helpers/core/pageData.ts';

/** One field of a simple update op: what it was, what the user set, what upstream has now */
export interface ConflictField {
	field: string;
	was: unknown;
	you: unknown;
	upstreamNow: unknown;
}

/** One row on the Conflicts tab, from src/routes/databases/[id]/conflicts/+page.server.ts */
export interface ConflictRow {
	opId: number;
	/** `conflicted_pending` under Ask; `conflicted` before an automatic resolution */
	status: string;
	/** `guard_mismatch`, `duplicate_key` or `missing_target` */
	conflictReason: string | null;
	appliedAt: string;
	operation: string;
	/** The entity type's key, e.g. `regular_expression` */
	entity: string;
	name: string;
	title: string;
	summary: string | null;
	origin: string;
	groupId: string | null;
	/** Per-field breakdown for simple updates; empty when `complex` */
	fields: ConflictField[];
	/** True for creates, deletes and list changes, which have no per-field breakdown */
	complex: boolean;
}

export interface ConflictsPageData {
	/** The database's strategy key: `override`, `align` or `ask` */
	conflictStrategy: string;
	conflicts: ConflictRow[];
}

const CONFLICTS_PATH = /^\/databases\/\d+\/conflicts$/;
const DATABASE_PATH = /^\/databases\/\d+\//;

/** Reach the database's Conflicts tab from wherever the page is */
async function openConflicts(page: Page, database: string): Promise<void> {
	const path = new URL(page.url(), 'http://flows.invalid').pathname;
	if (CONFLICTS_PATH.test(path)) return;
	if (!DATABASE_PATH.test(path)) await openDatabase(page, database);
	await openTab(page, 'Conflicts');
}

export const conflictsPage = {
	/** The database's strategy and conflict rows, read from its Conflicts tab */
	async read(page: Page, database = FIXTURES_NAME): Promise<ConflictsPageData> {
		return await test.step(
			`Read the Conflicts tab of ${database}`,
			async () => {
				await openConflicts(page, database);
				const data = await pageData<ConflictsPageData>(page);
				return { conflictStrategy: data.conflictStrategy, conflicts: data.conflicts };
			},
			{ box: true }
		);
	},

	/** The database's conflict rows, read from its Conflicts tab */
	async list(page: Page, database = FIXTURES_NAME): Promise<ConflictRow[]> {
		return (await conflictsPage.read(page, database)).conflicts;
	}
};

export interface ResolveOptions {
	/** The conflicted op, as `ConflictRow.opId` */
	opId: number;
	/** Align drops the local change; Override reapplies it on top of upstream */
	action: 'Align' | 'Override';
}

/** Fail with the app's message unless an action's result reports success */
function expectSuccess(result: ActionResult, what: string): void {
	const data = (result.data ?? {}) as { success?: boolean; error?: string };
	if (result.type !== 'success' || data.success === false) {
		const message = data.error ?? JSON.stringify(result.error ?? result.data);
		throw new Error(`${what} answered ${result.type} (${result.status}): ${message}`);
	}
}

/**
 * Resolve one row on the open Conflicts tab with its Align or Override
 * button, and wait until the app has recompiled and the row has gone. Each
 * row is a group named "#<opId> <reason>", so the op id finds it. Fails with
 * the app's message when the resolution doesn't succeed.
 */
export async function resolveConflict(page: Page, options: ResolveOptions): Promise<void> {
	const { opId, action } = options;
	await test.step(
		`${action} conflict #${opId}`,
		async () => {
			const row = page.getByRole('main').getByRole('group', { name: new RegExp(`^#${opId} `) });
			await expect(row, `Conflicts should list op #${opId}`).toBeVisible();

			const posted = waitForAction(page, action.toLowerCase());
			await row.getByRole('button', { name: action, exact: true }).click();
			expectSuccess(await posted, `${action} on op #${opId}`);
			await expect(row, `Op #${opId} should leave the list once resolved`).toHaveCount(0);
		},
		{ box: true }
	);
}
