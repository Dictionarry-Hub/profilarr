/**
 * Set up an Arr's Sync page and run its syncs.
 *
 * The page enforces a setup order: Quality Profiles only save once Media
 * Management and a delay profile are saved. `setUpProfileSync` does all of it
 * in that order; the step helpers set up one section each, for tests that need
 * only one or that check the order itself. Choices default to the first
 * fixtures config of each kind.
 *
 * Where quality definitions are chosen depends on the target: in Media
 * Management, or in Quality Profiles when the target stores sizes on each
 * profile (`profileSizes`, Sonarr v5). The helpers follow the target's
 * capabilities, so a scenario passes the same choices for every target.
 *
 * Clicking Sync only queues a job. The sync action marks the section as
 * pending before it answers, so once its answer arrives, the section's status
 * in `/api/v1/status` moves from pending through in_progress to idle (done)
 * or failed. That status is the signal; the page itself shows no result.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { FIXTURES_NAME } from '#flows/harness/seed.ts';
import { fixtures } from '#flows/helpers/core/fixtureData.ts';
import { chooseOption, saveForm, waitForAction } from '#flows/helpers/core/forms.ts';
import { openTab } from '#flows/helpers/core/nav.ts';
import { pageData } from '#flows/helpers/core/pageData.ts';
import { addArr, openArr } from './arrs.ts';
import type { FakeArr } from './fakeArr.ts';
import { hasCapability } from './targets.ts';

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

/** One section's sync state in `/api/v1/status` */
export interface SectionStatus {
	status: 'idle' | 'pending' | 'in_progress' | 'failed';
	lastSyncedAt: string | null;
	/** Quality Profiles: how many profiles are selected */
	count?: number;
	/** Delay Profiles and Media Management: whether anything is chosen */
	configured?: boolean;
}

/** An Arr's entry in `/api/v1/status` */
export interface ArrSyncStatus {
	id: number;
	name: string;
	type: 'radarr' | 'sonarr';
	sync: Record<SectionKey, SectionStatus>;
	/** Always null; drift is read from the Drift tab instead */
	drift: null;
}

/** An Arr's sync state as `/api/v1/status` reports it; fails when the Arr isn't listed */
export async function arrSyncStatus(page: Page, arrId: number): Promise<ArrSyncStatus> {
	const response = await page.request.get(`${new URL(page.url()).origin}/api/v1/status`);
	expect(response.ok(), 'GET /api/v1/status should answer').toBe(true);
	const status = (await response.json()) as { arrs: ArrSyncStatus[] };
	const arr = status.arrs.find((candidate) => candidate.id === arrId);
	if (!arr) throw new Error(`/api/v1/status lists no Arr with id ${arrId}`);
	return arr;
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

			const region = syncRegion(page, section);
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
						const sync = (await arrSyncStatus(page, arrId)).sync[key];
						if (sync.status === 'idle' || sync.status === 'failed') {
							finished = { status: sync.status, lastSyncedAt: sync.lastSyncedAt };
						}
						return sync.status;
					},
					{ message: `${section} sync should finish`, timeout: 15_000 }
				)
				.toMatch(/^(idle|failed)$/);
			return finished as SectionSync;
		},
		{ box: true }
	);
}

/** A section of the open Sync page */
export function syncRegion(page: Page, section: SyncSection): Locator {
	return page.getByRole('main').getByRole('region', { name: section, exact: true });
}

/** Choose a section's "Trigger", e.g. "Schedule", on the open Sync page. Save it afterwards. */
export async function setTrigger(page: Page, section: SyncSection, label: string): Promise<void> {
	await chooseOption(syncRegion(page, section), 'Trigger', label);
}

/** One section's progress chip on the Sync page: how many synced items drifted */
export interface SectionProgress {
	total: number;
	drifted: number;
	message?: string;
}

/** What the Sync page stores for an Arr, and its drift chips */
export interface SyncConfig {
	syncData: {
		qualityProfiles: {
			selections: {
				databaseId: number;
				profileName: string;
				qualityDefinitionsConfigName: string | null;
			}[];
			config: { trigger: string; cron: string | null; nextRunAt?: string | null };
		};
		delayProfiles: {
			databaseId: number | null;
			profileName: string | null;
			trigger: string;
			cron: string | null;
			nextRunAt?: string | null;
		};
		mediaManagement: {
			namingDatabaseId: number | null;
			namingConfigName: string | null;
			qualityDefinitionsDatabaseId: number | null;
			qualityDefinitionsConfigName: string | null;
			mediaSettingsDatabaseId: number | null;
			mediaSettingsConfigName: string | null;
			trigger: string;
			cron: string | null;
			nextRunAt?: string | null;
		};
	};
	/** Null until drift is on and has a clean or drifted result */
	driftProgress: Partial<
		Record<
			| 'customFormats'
			| 'qualityProfiles'
			| 'delayProfiles'
			| 'naming'
			| 'qualityDefinitions'
			| 'mediaSettings',
			SectionProgress
		>
	> | null;
}

/** The Sync page's stored choices (`syncData`) and drift chips (`driftProgress`) for an Arr */
export async function syncConfig(page: Page, arrId: number): Promise<SyncConfig> {
	const data = await pageData<SyncConfig>(page, `/arr/${arrId}/sync`);
	return { syncData: data.syncData, driftProgress: data.driftProgress };
}

/** How a fixtures config shows in the Sync page's dropdowns */
const fromFixtures = (config: string) => `${FIXTURES_NAME} / ${config}`;

/** Config names to choose; each defaults to the first fixtures config of its kind */
export interface MediaManagementChoices {
	naming?: string;
	mediaSettings?: string;
	/** Chosen here on targets with global quality definitions; ignored on `profileSizes` targets */
	qualityDefinitions?: string;
}

/**
 * Add the fake as an Arr instance and open its Sync tab. The name defaults to
 * "Fake <label>", e.g. "Fake Sonarr".
 */
export async function addArrAndOpenSync(page: Page, fake: FakeArr, name?: string): Promise<void> {
	const instance = name ?? `Fake ${fake.target.label}`;
	await addArr(page, { name: instance, fake });
	await openArr(page, instance);
	await openTab(page, 'Sync');
}

/**
 * Choose naming, media settings and, where the target sets them here,
 * quality definitions in Media Management, then save the section.
 */
export async function chooseMediaManagement(
	page: Page,
	fake: FakeArr,
	choices: MediaManagementChoices = {}
): Promise<void> {
	await test.step(
		`Choose ${fake.target.id} media management`,
		async () => {
			const section = syncRegion(page, 'Media Management');
			const app = fake.type;
			await chooseOption(
				section,
				'Naming',
				fromFixtures(choices.naming ?? fixtures.naming[app][0].name)
			);
			if (hasCapability(fake.target, 'qualityDefinitions')) {
				await chooseOption(
					section,
					'Quality Definitions',
					fromFixtures(choices.qualityDefinitions ?? fixtures.qualityDefinitions[app][0].name)
				);
			}
			await chooseOption(
				section,
				'Media Settings',
				fromFixtures(choices.mediaSettings ?? fixtures.mediaSettings[app][0].name)
			);
			await saveForm(page, { within: section, action: 'saveMediaManagement' });
		},
		{ box: true }
	);
}

/** Turn on one delay profile, by default the first in the fixtures, and save the section */
export async function chooseDelayProfile(page: Page, name?: string): Promise<void> {
	const profile = name ?? fixtures.delayProfiles[0].name;
	await test.step(
		`Choose delay profile ${profile}`,
		async () => {
			const section = syncRegion(page, 'Delay Profiles');
			await section
				.getByRole('switch', { name: `Toggle delay profile ${profile} from ${FIXTURES_NAME}` })
				.click();
			await saveForm(page, { within: section, action: 'saveDelayProfiles' });
		},
		{ box: true }
	);
}

export interface QualityProfileChoices {
	/**
	 * The global quality definitions config, on `profileSizes` targets. Defaults
	 * to the first fixtures config; ignored on other targets, which choose it in
	 * Media Management.
	 */
	qualityDefinitions?: string;
	/** Per-profile quality definitions configs, or "Global", on `profileSizes` targets */
	perProfile?: Record<string, string>;
}

/**
 * Turn on quality profiles and save the section. On `profileSizes` targets,
 * also choose the global quality definitions and any per-profile ones. Media
 * Management and a delay profile must be saved first.
 */
export async function chooseQualityProfiles(
	page: Page,
	fake: FakeArr,
	profiles: string[],
	choices: QualityProfileChoices = {}
): Promise<void> {
	await test.step(
		`Choose quality profiles ${profiles.join(', ')}`,
		async () => {
			const section = syncRegion(page, 'Quality Profiles');
			for (const name of profiles) {
				await section
					.getByRole('switch', { name: `Toggle quality profile ${name} from ${FIXTURES_NAME}` })
					.click();
			}

			if (hasCapability(fake.target, 'profileSizes')) {
				const global = choices.qualityDefinitions ?? fixtures.qualityDefinitions[fake.type][0].name;
				await chooseOption(section, 'Global Quality Definition', fromFixtures(global));
				for (const [profile, config] of Object.entries(choices.perProfile ?? {})) {
					await chooseOption(section, `${profile} Quality Definition`, config);
				}
			} else if (choices.perProfile) {
				throw new Error(`${fake.target.id} has no per-profile quality definitions`);
			}

			await saveForm(page, { within: section, action: 'saveQualityProfiles' });
		},
		{ box: true }
	);
}

export interface ProfileSyncOptions extends MediaManagementChoices {
	/** Quality profiles to sync */
	profiles: string[];
	/** The Arr instance's name. Default "Fake <label>". */
	name?: string;
	delayProfile?: string;
	/** Per-profile quality definitions, on `profileSizes` targets */
	perProfile?: Record<string, string>;
}

/**
 * Get an Arr ready to sync quality profiles: add the fake, open its Sync tab,
 * and save Media Management, a delay profile and the quality profiles, in the
 * page's order. `qualityDefinitions` lands in whichever section the target
 * chooses it in.
 */
export async function setUpProfileSync(
	page: Page,
	fake: FakeArr,
	options: ProfileSyncOptions
): Promise<void> {
	await test.step(
		`Set up ${fake.target.id} to sync ${options.profiles.join(', ')}`,
		async () => {
			await addArrAndOpenSync(page, fake, options.name);
			await chooseMediaManagement(page, fake, options);
			await chooseDelayProfile(page, options.delayProfile);
			await chooseQualityProfiles(page, fake, options.profiles, {
				qualityDefinitions: options.qualityDefinitions,
				perProfile: options.perProfile
			});
		},
		{ box: true }
	);
}
