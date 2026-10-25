/**
 * Cleanup helpers for an Arr's Settings tab. Run Now opens the Cleanup dialog,
 * which scans the Arr first (`/arr/{id}/settings/cleanup/preview`) and lists
 * the stale formats and profiles and the removed media. Clean Up queues an
 * `arr.cleanup` job that deletes exactly what the preview found.
 *
 * Run Now only shows while Cleanup is on and saved (`setCleanup` in arrs.ts).
 */

import { expect, test, type Page } from '@playwright/test';
import { waitForAction } from '$flows/helpers/core/forms.ts';
import { waitForJobRun, type JobRun } from '$flows/helpers/core/jobs.ts';
import { pageData } from '$flows/helpers/core/pageData.ts';
import type { CleanupSettings } from '$flows/helpers/sync/arrs.ts';

/** A stale format or profile, by its id on the Arr */
export interface StaleItem {
	id: number;
	name: string;
}

/** A movie or series the Arr flagged as removed from TMDb or TheTVDB */
export interface RemovedEntity {
	id: number;
	title: string;
	/** The TMDb or TVDB id */
	externalId: number;
}

type PreviewSection<T> = { ok: true; data: T } | { ok: false; error: string };

/** What the cleanup preview found */
export interface CleanupPreview {
	configs: PreviewSection<{ staleCustomFormats: StaleItem[]; staleQualityProfiles: StaleItem[] }>;
	entities: PreviewSection<{ removedEntities: RemovedEntity[] }>;
}

/** The Cleanup dialog */
export function cleanupDialog(page: Page) {
	return page.getByRole('dialog', { name: 'Cleanup', exact: true });
}

/**
 * Click Run Now on the open Settings tab and wait for the Cleanup dialog's
 * scan. Returns what the preview found.
 */
export async function openCleanup(page: Page): Promise<CleanupPreview> {
	return await test.step(
		'Open the cleanup preview',
		async () => {
			const scanned = page.waitForResponse(
				(response) =>
					response.request().method() === 'GET' &&
					/^\/arr\/\d+\/settings\/cleanup\/preview$/.test(new URL(response.url()).pathname)
			);
			await page.getByRole('main').getByRole('button', { name: 'Run Now', exact: true }).click();
			const response = await scanned;
			expect(response.ok(), 'The cleanup preview should answer').toBe(true);
			const preview = (await response.json()) as CleanupPreview;
			await expect(
				cleanupDialog(page).getByRole('button', { name: /^(Clean Up|Close)$/ }),
				'The Cleanup dialog should show the scan result'
			).toBeVisible();
			return preview;
		},
		{ box: true }
	);
}

/**
 * Click Clean Up in the open Cleanup dialog, check the job is queued, and wait
 * for its `arr.cleanup` run. Returns the run.
 */
export async function confirmCleanup(page: Page): Promise<JobRun> {
	return await test.step(
		'Confirm the cleanup',
		async () => {
			const after = Date.now();
			const queued = waitForAction(page, 'runCleanupNow');
			await cleanupDialog(page).getByRole('button', { name: 'Clean Up', exact: true }).click();
			const result = await queued;
			expect(result.type, `The cleanup should be queued: ${JSON.stringify(result.data)}`).toBe(
				'success'
			);
			return await waitForJobRun(page, 'arr.cleanup', { after });
		},
		{ box: true }
	);
}

/** An instance's cleanup schedule, from its Settings tab's `cleanupSettings` */
export async function cleanupSettings(page: Page, arrId: number): Promise<CleanupSettings | null> {
	const { cleanupSettings } = await pageData<{ cleanupSettings: CleanupSettings | null }>(
		page,
		`/arr/${arrId}/settings`
	);
	return cleanupSettings;
}
