/**
 * Quality profile syncer
 * Syncs quality profiles from PCD to arr instances
 *
 * All selected profiles must come from a single database (enforced by the UI).
 *
 * Sync order:
 * 1. Fetch profiles and referenced CFs from the database's PCD cache
 * 2. Sync custom formats → build formatIdMap
 * 3. Sync quality profiles using the formatIdMap
 */

import { BaseSyncer, type SyncResult } from '../base.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { getCache, getCachedDatabaseIds } from '$pcd/index.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { logger } from '$logger/logger.ts';
import type { SyncArrType } from '../mappings.ts';

// Custom formats
import {
	fetchCustomFormatFromPcd,
	syncCustomFormats,
	type PcdCustomFormat
} from '../customFormats/index.ts';
import {
	fetchQualityProfileFromPcd,
	getQualityApiMappings,
	transformQualityProfile,
	type PcdQualityProfile
} from './transformer.ts';
import { getCustomFormatsForProfile } from '$pcd/references.ts';

// Internal types for sync data
interface ProfileSyncData {
	pcdProfile: PcdQualityProfile;
	referencedFormatNames: string[];
}

interface SyncedProfileSummary {
	name: string;
	action: 'created' | 'updated';
	language: string;
	cutoffFormatScore: number;
	minFormatScore: number;
	formats: { name: string; score: number }[];
}

export class QualityProfileSyncer extends BaseSyncer {
	private instanceType: SyncArrType;

	constructor(
		client: ConstructorParameters<typeof BaseSyncer>[0],
		instanceId: number,
		instanceName: string,
		instanceType: SyncArrType
	) {
		super(client, instanceId, instanceName);
		this.instanceType = instanceType;
	}

	protected get syncType(): string {
		return 'quality profiles';
	}

	/**
	 * Override sync to handle the quality profile sync flow
	 */
	override async sync(): Promise<SyncResult> {
		try {
			await logger.info(`Starting quality profile sync for "${this.instanceName}"`, {
				source: 'Sync:QualityProfiles',
				meta: { instanceId: this.instanceId, instanceType: this.instanceType }
			});

			// 1. Fetch profiles and CFs from the single database
			const { profiles, customFormats, databaseId } = await this.fetchSyncData();

			if (profiles.length === 0) {
				await logger.debug(`No quality profiles to sync for "${this.instanceName}"`, {
					source: 'Sync:QualityProfiles',
					meta: { instanceId: this.instanceId }
				});
				return { success: true, itemsSynced: 0 };
			}

			// 2. Sync custom formats
			const formatIdMap = await syncCustomFormats(
				this.client,
				this.instanceId,
				this.instanceType,
				customFormats
			);

			// 3. Get quality API mappings
			const cache = getCache(databaseId);
			if (!cache) throw new Error(`PCD cache not found for database ${databaseId}`);
			const qualityMappings = await getQualityApiMappings(cache, this.instanceType);

			// 4. Sync quality profiles
			const existingProfiles = await this.client.getQualityProfiles();
			const existingMap = new Map(existingProfiles.map((p) => [p.name, p.id]));

			const syncedProfiles = await this.syncQualityProfiles(
				profiles,
				formatIdMap,
				qualityMappings,
				existingMap
			);

			await logger.info(`Completed quality profile sync for "${this.instanceName}"`, {
				source: 'Sync:QualityProfiles',
				meta: {
					instanceId: this.instanceId,
					databaseId,
					profiles: syncedProfiles.map((p) => ({
						name: p.name,
						action: p.action,
						formats: p.formats.length
					}))
				}
			});

			return {
				success: true,
				itemsSynced: syncedProfiles.length,
				items: syncedProfiles.map((p) => ({ name: p.name, action: p.action }))
			};
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';

			await logger.error(`Failed quality profile sync for "${this.instanceName}"`, {
				source: 'Sync:QualityProfiles',
				meta: { instanceId: this.instanceId, error: errorMsg }
			});

			return { success: false, itemsSynced: 0, error: errorMsg };
		}
	}

	/**
	 * Fetch profiles and CFs from the single database.
	 * All selections must belong to one database (enforced by frontend).
	 */
	private async fetchSyncData(): Promise<{
		profiles: ProfileSyncData[];
		customFormats: Map<string, PcdCustomFormat>;
		databaseId: number;
	}> {
		const syncConfig = arrSyncQueries.getQualityProfilesSync(this.instanceId);

		if (syncConfig.selections.length === 0) {
			return { profiles: [], customFormats: new Map(), databaseId: 0 };
		}

		// All selections come from a single database
		const databaseId = syncConfig.selections[0].databaseId;

		const dbInstance = databaseInstancesQueries.getById(databaseId);
		if (!dbInstance) {
			await logger.warn(`Skipping sync for deleted database ${databaseId}`, {
				source: 'Sync:QualityProfiles',
				meta: { instanceId: this.instanceId, databaseId }
			});
			return { profiles: [], customFormats: new Map(), databaseId };
		}

		const cache = getCache(databaseId);
		if (!cache) {
			const cachedIds = getCachedDatabaseIds();
			await logger.warn(`PCD cache not found for database ${databaseId}`, {
				source: 'Sync:QualityProfiles',
				meta: {
					instanceId: this.instanceId,
					requestedDatabaseId: databaseId,
					cachedDatabaseIds: cachedIds,
					databaseExists: !!dbInstance,
					databaseEnabled: dbInstance?.enabled ?? null,
					databaseName: dbInstance?.name ?? null
				}
			});
			return { profiles: [], customFormats: new Map(), databaseId };
		}

		const profiles: ProfileSyncData[] = [];
		const customFormats = new Map<string, PcdCustomFormat>();

		for (const selection of syncConfig.selections) {
			// Fetch the quality profile
			const pcdProfile = await fetchQualityProfileFromPcd(
				cache,
				selection.profileName,
				this.instanceType
			);
			if (!pcdProfile) {
				await logger.warn(
					`Quality profile "${selection.profileName}" not found in database ${databaseId}`,
					{
						source: 'Sync:QualityProfiles',
						meta: { instanceId: this.instanceId, profileName: selection.profileName }
					}
				);
				continue;
			}

			// Get referenced custom format names
			const referencedFormatNames = await getCustomFormatsForProfile(
				cache,
				selection.profileName,
				this.instanceType
			);

			profiles.push({ pcdProfile, referencedFormatNames });

			// Fetch custom formats (dedupe by name)
			for (const formatName of referencedFormatNames) {
				if (!customFormats.has(formatName)) {
					const pcdFormat = await fetchCustomFormatFromPcd(cache, formatName);
					if (pcdFormat) {
						customFormats.set(formatName, pcdFormat);
					}
				}
			}
		}

		return { profiles, customFormats, databaseId };
	}

	/**
	 * Sync quality profiles to the arr instance.
	 */
	private async syncQualityProfiles(
		profiles: ProfileSyncData[],
		formatIdMap: Map<string, number>,
		qualityMappings: Map<string, string>,
		existingMap: Map<string, number>
	): Promise<SyncedProfileSummary[]> {
		const syncedProfiles: SyncedProfileSummary[] = [];

		for (const { pcdProfile } of profiles) {
			const arrProfile = transformQualityProfile(
				pcdProfile,
				this.instanceType,
				qualityMappings,
				formatIdMap
			);

			arrProfile.name = pcdProfile.name;

			await logger.debug(`Compiled quality profile "${pcdProfile.name}"`, {
				source: 'Compile:QualityProfile',
				meta: {
					instanceId: this.instanceId,
					pcdName: pcdProfile.name,
					profile: arrProfile
				}
			});

			try {
				const isUpdate = existingMap.has(pcdProfile.name);
				if (isUpdate) {
					// Update existing
					const existingId = existingMap.get(pcdProfile.name)!;
					arrProfile.id = existingId;
					await this.client.updateQualityProfile(existingId, arrProfile);
					await logger.debug(`Updated quality profile "${pcdProfile.name}"`, {
						source: 'Sync:QualityProfiles',
						meta: { instanceId: this.instanceId, profileId: existingId, pcdName: pcdProfile.name }
					});
				} else {
					// Create new
					const response = await this.client.createQualityProfile(arrProfile);
					existingMap.set(pcdProfile.name, response.id);
					await logger.debug(`Created quality profile "${pcdProfile.name}"`, {
						source: 'Sync:QualityProfiles',
						meta: { instanceId: this.instanceId, profileId: response.id, pcdName: pcdProfile.name }
					});
				}

				// Build summary for completion log
				const scoredFormats = arrProfile.formatItems
					.filter((f) => f.score !== 0)
					.map((f) => ({ name: f.name, score: f.score }));

				syncedProfiles.push({
					name: pcdProfile.name,
					action: isUpdate ? 'updated' : 'created',
					language: arrProfile.language?.name ?? 'N/A',
					cutoffFormatScore: arrProfile.cutoffFormatScore,
					minFormatScore: arrProfile.minFormatScore,
					formats: scoredFormats
				});
			} catch (error) {
				const errorDetails = this.extractErrorDetails(error);
				await logger.error(`Failed to sync quality profile "${pcdProfile.name}"`, {
					source: 'Sync:QualityProfiles',
					meta: {
						instanceId: this.instanceId,
						pcdName: pcdProfile.name,
						request: arrProfile,
						...errorDetails
					}
				});
			}
		}

		return syncedProfiles;
	}

	/**
	 * Extract error details from HTTP errors for logging
	 */
	private extractErrorDetails(error: unknown): Record<string, unknown> {
		const details: Record<string, unknown> = {
			error: error instanceof Error ? error.message : 'Unknown error'
		};

		if (error && typeof error === 'object') {
			const err = error as Record<string, unknown>;
			if ('status' in err) details.status = err.status;
			if ('statusText' in err) details.statusText = err.statusText;
			if ('response' in err) details.response = err.response;
			if ('body' in err) details.responseBody = err.body;
			if ('data' in err) details.responseData = err.data;
			if (err.cause) details.cause = err.cause;
		}

		return details;
	}

	// Base class abstract methods - implemented but not used since we override sync()
	protected async fetchFromPcd(): Promise<unknown[]> {
		return [];
	}

	protected transformToArr(_pcdData: unknown[]): unknown[] {
		return [];
	}

	protected async pushToArr(_arrData: unknown[]): Promise<void> {
		// Not used - logic is in sync()
	}
}
