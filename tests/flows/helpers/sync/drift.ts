/**
 * Drift helpers for an Arr's Drift tab. Drift is off for a new instance, so a
 * scenario turns it on with `enableDrift`, then checks with `runDriftCheck`.
 * Run Now only queues an `arr.drift` job, so `runDriftCheck` waits for its run
 * and reloads the tab to show the result.
 *
 * `/api/v1/status` always reports `drift: null`, so `driftState` reads the
 * Drift tab's data instead.
 */

import { expect, test, type Page } from '@playwright/test';
import { saveForm, waitForAction } from '#flows/helpers/core/forms.ts';
import { latestJobRunId, waitForNextJobRun, type JobRun } from '#flows/helpers/core/jobs.ts';
import { openTab, waitForHydration } from '#flows/helpers/core/nav.ts';
import { pageData } from '#flows/helpers/core/pageData.ts';

/** One drifted item the Drift tab lists */
export interface DriftEntity {
	id: string;
	section: 'custom_formats' | 'quality_profiles' | 'delay_profiles' | 'media_management';
	sectionLabel: string;
	title: string;
	state: 'missing' | 'modified' | 'extra';
	summary: string;
	changes: { id: string; label: string; detail?: string }[];
}

/** An Arr's latest drift result, as its Drift tab loads it */
export interface DriftState {
	enabled: boolean;
	status: 'never_checked' | 'clean' | 'drift_detected' | 'failed';
	lastCheckedAt: string | null;
	lastError: string | null;
	entities: DriftEntity[];
	/** The drift count the instance's layout shows on the Drift tab */
	driftCount: number;
}

interface DriftPageData {
	settings: { enabled: boolean };
	status: { status: DriftState['status']; lastCheckedAt: string | null; lastError: string | null };
	driftEntities: DriftEntity[];
	driftCount: number;
}

/** The open Arr's id, from a page under `/arr/{id}/` */
function arrIdOf(page: Page): number {
	const id = Number(new URL(page.url()).pathname.match(/^\/arr\/(\d+)\//)?.[1]);
	if (!id) throw new Error(`Expected an Arr's page, not ${new URL(page.url()).pathname}`);
	return id;
}

/** Open the Drift tab of the open Arr, unless the page is already on it */
async function onDrift(page: Page): Promise<void> {
	if (new URL(page.url()).pathname.endsWith('/drift')) await waitForHydration(page);
	else await openTab(page, 'Drift');
}

/** Turn on drift detection on the open Arr's Drift tab and save */
export async function enableDrift(page: Page): Promise<void> {
	await test.step(
		'Turn on drift detection',
		async () => {
			await onDrift(page);
			const toggle = page.getByRole('main').getByRole('switch', { name: 'Detection', exact: true });
			await expect(toggle, 'Detection should start off').toHaveAttribute('aria-checked', 'false');
			await toggle.click();
			await saveForm(page, { action: 'save' });
			expect(
				(await driftState(page, arrIdOf(page))).enabled,
				'Drift detection should be saved as on'
			).toBe(true);
		},
		{ box: true }
	);
}

/**
 * Click Run Now on the open Arr's Drift tab, wait for the `arr.drift` run it
 * queues, then reload the tab so it shows the result. Returns the run. The
 * run is told apart by id, so a drift run a sync chained in the same second
 * doesn't pass for it.
 */
export async function runDriftCheck(page: Page): Promise<JobRun> {
	return await test.step(
		'Run a drift check',
		async () => {
			await onDrift(page);
			const lastRun = await latestJobRunId(page, 'arr.drift');
			const queued = waitForAction(page, 'run');
			await page.getByRole('main').getByRole('button', { name: 'Run Now', exact: true }).click();
			const result = await queued;
			expect(result.type, `The drift check should be queued: ${JSON.stringify(result.data)}`).toBe(
				'success'
			);
			const run = await waitForNextJobRun(page, 'arr.drift', { afterId: lastRun });
			await page.reload();
			await waitForHydration(page);
			return run;
		},
		{ box: true }
	);
}

/** An Arr's drift settings, latest result and drifted items, from its Drift tab's data */
export async function driftState(page: Page, arrId: number): Promise<DriftState> {
	const data = await pageData<DriftPageData>(page, `/arr/${arrId}/drift`);
	return {
		enabled: data.settings.enabled,
		status: data.status.status,
		lastCheckedAt: data.status.lastCheckedAt,
		lastError: data.status.lastError,
		entities: data.driftEntities,
		driftCount: data.driftCount
	};
}
