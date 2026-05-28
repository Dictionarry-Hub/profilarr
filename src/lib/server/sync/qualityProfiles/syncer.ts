/**
 * Quality profile syncer
 * Syncs quality profiles from PCD to arr instances
 *
 * Supports multiple databases per instance via priority ordering. Databases
 * are processed from lowest priority to highest so the highest-priority
 * database's entities overwrite earlier ones via Arr's name-based matching.
 *
 * Sync order per database:
 * 1. Fetch profiles and referenced CFs from the database's PCD cache
 * 2. Sync custom formats (accumulate into shared formatIdMap)
 * 3. Sync quality profiles using the formatIdMap
 */

import { BaseSyncer, type SyncResult } from '../base.ts';
import { arrSyncQueries, type ProfileSelection } from '$db/queries/arrSync.ts';
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
	 * Override sync to handle multi-database quality profile sync flow.
	 * Processes databases from lowest priority to highest so the highest-
	 * priority database's entities are what remain in Arr after sync.
	 */
	override async sync(): Promise<SyncResult> {
		try {
			const syncConfig = arrSyncQueries.getQualityProfilesSync(this.instanceId);

			if (syncConfig.selections.length === 0) {
				await logger.debug(`No quality profiles to sync for "${this.instanceName}"`, {
					source: 'Sync:QualityProfiles',
					meta: { instanceId: this.instanceId }
				});
				return { success: true, itemsSynced: 0 };
			}

			const priorities = arrSyncQueries.getDatabasePriorities(this.instanceId);

			// Group selections by database
			const selectionsByDb = new Map<number, ProfileSelection[]>();
			for (const sel of syncConfig.selections) {
				if (!selectionsByDb.has(sel.databaseId)) {
					selectionsByDb.set(sel.databaseId, []);
				}
				selectionsByDb.get(sel.databaseId)!.push(sel);
			}

			// Sort: highest priority number first (lowest priority syncs first, highest last wins)
			const sortedDbIds = [...selectionsByDb.keys()].sort((a, b) => {
				const pa = priorities.find((p) => p.databaseId === a)?.priority ?? Infinity;
				const pb = priorities.find((p) => p.databaseId === b)?.priority ?? Infinity;
				return pb - pa;
			});

			const existingProfiles = await this.client.getQualityProfiles();
			const existingMap = new Map(existingProfiles.map((p) => [p.name, p.id]));

			const allFormatIdMap = new Map<string, number>();
			const allSyncedProfiles: SyncedProfileSummary[] = [];

			for (const databaseId of sortedDbIds) {
				const dbSelections = selectionsByDb.get(databaseId)!;

				try {
					const { profiles, customFormats } = await this.fetchSyncDataForDatabase(
						databaseId,
						dbSelections
					);

					if (profiles.length === 0) continue;

					const formatIdMap = await syncCustomFormats(
						this.client,
						this.instanceId,
						this.instanceType,
						customFormats
					);
					for (const [k, v] of formatIdMap) allFormatIdMap.set(k, v);

					const cache = getCache(databaseId);
					if (!cache) continue;
					const qualityMappings = await getQualityApiMappings(cache, this.instanceType);

					const synced = await this.syncQualityProfiles(
						profiles,
						allFormatIdMap,
						qualityMappings,
						existingMap
					);
					allSyncedProfiles.push(...synced);

					await logger.info(
						`Synced ${synced.length} profile(s) from database ${databaseId} for "${this.instanceName}"`,
						{
							source: 'Sync:QualityProfiles',
							meta: {
								instanceId: this.instanceId,
								databaseId,
								profiles: synced.map((p) => ({
									name: p.name,
									action: p.action,
									formats: p.formats.length
								}))
							}
						}
					);
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : 'Unknown error';
					await logger.error(
						`Failed syncing database ${databaseId} for "${this.instanceName}", continuing`,
						{
							source: 'Sync:QualityProfiles',
							meta: { instanceId: this.instanceId, databaseId, error: errorMsg }
						}
					);
				}
			}

			await logger.info(`Completed quality profile sync for "${this.instanceName}"`, {
				source: 'Sync:QualityProfiles',
				meta: {
					instanceId: this.instanceId,
					databases: sortedDbIds,
					totalProfiles: allSyncedProfiles.length
				}
			});

			return {
				success: true,
				itemsSynced: allSyncedProfiles.length,
				items: allSyncedProfiles.map((p) => ({ name: p.name, action: p.action }))
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
	 * Fetch profiles and CFs from a specific database for the given selections.
	 */
	private async fetchSyncDataForDatabase(
		databaseId: number,
		selections: ProfileSelection[]
	): Promise<{
		profiles: ProfileSyncData[];
		customFormats: Map<string, PcdCustomFormat>;
	}> {
		const dbInstance = databaseInstancesQueries.getById(databaseId);
		if (!dbInstance) {
			await logger.warn(`Skipping sync for deleted database ${databaseId}`, {
				source: 'Sync:QualityProfiles',
				meta: { instanceId: this.instanceId, databaseId }
			});
			return { profiles: [], customFormats: new Map() };
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
			return { profiles: [], customFormats: new Map() };
		}

		const profiles: ProfileSyncData[] = [];
		const customFormats = new Map<string, PcdCustomFormat>();

		for (const selection of selections) {
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

			const referencedFormatNames = await getCustomFormatsForProfile(
				cache,
				selection.profileName,
				this.instanceType
			);

			profiles.push({ pcdProfile, referencedFormatNames });

			for (const formatName of referencedFormatNames) {
				if (!customFormats.has(formatName)) {
					const pcdFormat = await fetchCustomFormatFromPcd(cache, formatName);
					if (pcdFormat) {
						customFormats.set(formatName, pcdFormat);
					}
				}
			}
		}

		return { profiles, customFormats };
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
					const existingId = existingMap.get(pcdProfile.name)!;
					arrProfile.id = existingId;
					await this.client.updateQualityProfile(existingId, arrProfile);
					await logger.debug(`Updated quality profile "${pcdProfile.name}"`, {
						source: 'Sync:QualityProfiles',
						meta: { instanceId: this.instanceId, profileId: existingId, pcdName: pcdProfile.name }
					});
				} else {
					const response = await this.client.createQualityProfile(arrProfile);
					existingMap.set(pcdProfile.name, response.id);
					await logger.debug(`Created quality profile "${pcdProfile.name}"`, {
						source: 'Sync:QualityProfiles',
						meta: { instanceId: this.instanceId, profileId: response.id, pcdName: pcdProfile.name }
					});
				}

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
