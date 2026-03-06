/**
 * Link a PCD database instance through the UI.
 */
import type { Page } from '@playwright/test';
import { selectDropdownByLabel } from './dropdown';
import { getDatabaseByName } from './db';

export interface LinkPcdOpts {
	name: string;
	repoUrl: string;
	branch?: string;
	pat?: string;
	gitName?: string;
	gitEmail?: string;
	syncStrategy?: string;
	autoPull?: boolean;
	localOpsEnabled?: boolean;
	conflictStrategy?: string;
}

/**
 * Navigate to /databases/new, fill the form, save, and return the new database ID.
 */
export async function linkPcd(page: Page, opts: LinkPcdOpts): Promise<number> {
	await page.goto('/databases/new');
	await page.waitForLoadState('networkidle');

	// Required fields (labels include asterisk)
	await page.getByLabel('Name*').fill(opts.name);
	await page.getByLabel('Repository URL*').fill(opts.repoUrl);

	if (opts.branch) {
		await page.getByLabel('Branch').fill(opts.branch);
	}

	if (opts.pat) {
		await page.getByLabel('Personal Access Token').fill(opts.pat);
		// PAT triggers git identity fields to appear
		await page.waitForTimeout(300);

		if (opts.gitName) {
			await page.getByLabel('Git Author Name').fill(opts.gitName);
		}
		if (opts.gitEmail) {
			await page.getByLabel('Git Author Email').fill(opts.gitEmail);
		}
	}

	if (opts.syncStrategy) {
		await selectDropdownByLabel(page, 'Sync Strategy', opts.syncStrategy);
	}

	if (opts.autoPull === false) {
		await selectDropdownByLabel(page, 'Auto Pull', 'Disabled');
	}

	if (opts.localOpsEnabled) {
		await selectDropdownByLabel(page, 'Local Ops Only', 'Enabled');
	}

	if (opts.conflictStrategy) {
		await selectDropdownByLabel(page, 'Conflict Strategy', opts.conflictStrategy);
	}

	// Click Save and wait for redirect to /databases
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForURL('**/databases', { timeout: 30_000 });

	// Look up the ID from profilarr.db
	const db = getDatabaseByName(opts.name);
	if (!db) {
		throw new Error(`Database "${opts.name}" not found after linking`);
	}
	return db.id;
}
