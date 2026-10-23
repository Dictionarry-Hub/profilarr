/**
 * Run a sync from an Arr's Sync page and wait until it has finished.
 *
 * Clicking Sync only queues a job. The sync action marks the section as
 * pending before it answers, so once its answer arrives, the section's status
 * in `/api/v1/status` moves from pending through in_progress to idle (done)
 * or failed. That status is the signal; the page itself shows no result.
 */

import { expect, test, type Page } from '@playwright/test';
import { waitForAction } from '$flows/helpers/forms.ts';

export const SYNC_SECTIONS = {
	'Quality Profiles': { key: 'qualityProfiles', action: 'syncQualityProfiles' },
	'Delay Profiles': { key: 'delayProfiles', action: 'syncDelayProfiles' },
	'Media Management': { key: 'mediaManagement', action: 'syncMediaManagement' }
} as const;

export type SyncSection = keyof typeof SYNC_SECTIONS;
type SectionKey = (typeof SYNC_SECTIONS)[SyncSection]['key'];

export interface SectionSync {
	/** idle once the sync succeeded, failed when it didn't */
	status: 'idle' | 'failed';
	lastSyncedAt: string | null;
}

interface StatusResponse {
	arrs: { id: number; sync: Record<SectionKey, { status: string; lastSyncedAt: string | null }> }[];
}

/**
 * Click Sync in a section of the open Sync page (`/arr/{id}/sync`) and wait
 * for the job to finish. Fails if the page refuses to queue it, e.g. when the
 * section has nothing configured.
 */
export async function syncSection(page: Page, section: SyncSection): Promise<SectionSync> {
	return await test.step(
		`Sync ${section}`,
		async () => {
			const url = new URL(page.url());
			const arrId = Number(url.pathname.match(/^\/arr\/(\d+)\/sync$/)?.[1]);
			if (!arrId) throw new Error(`syncSection needs an Arr's Sync page, not ${url.pathname}`);
			const { key, action } = SYNC_SECTIONS[section];

			const region = page.getByRole('main').getByRole('region', { name: section, exact: true });
			const queued = waitForAction(page, action);
			await region.getByRole('button', { name: 'Sync', exact: true }).click();
			const result = await queued;
			expect(result.type, `${section} sync should be queued: ${JSON.stringify(result.data)}`).toBe(
				'success'
			);

			let finished: SectionSync | undefined;
			await expect
				.poll(
					async () => {
						const status = (await (
							await page.request.get(`${url.origin}/api/v1/status`)
						).json()) as StatusResponse;
						const sync = status.arrs.find((arr) => arr.id === arrId)?.sync[key];
						if (sync && (sync.status === 'idle' || sync.status === 'failed')) {
							finished = { status: sync.status, lastSyncedAt: sync.lastSyncedAt };
						}
						return sync?.status;
					},
					{ message: `${section} sync should finish`, timeout: 15_000 }
				)
				.toMatch(/^(idle|failed)$/);
			return finished as SectionSync;
		},
		{ box: true }
	);
}
