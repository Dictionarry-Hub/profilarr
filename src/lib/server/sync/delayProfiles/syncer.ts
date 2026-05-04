/**
 * Delay profile syncer
 *
 * Syncs a single delay profile from PCD to the arr instance's default profile (id=1).
 * Only one delay profile can be synced per arr - it overwrites the default.
 */

import { BaseSyncer, type SyncResult } from '../base.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { getCache } from '$pcd/index.ts';
import { getByName as getDelayProfileByName } from '$pcd/entities/delayProfiles/index.ts';
import { logger } from '$logger/logger.ts';
import { transformDelayProfile } from './transformer.ts';

export class DelayProfileSyncer extends BaseSyncer {
	protected get syncType(): string {
		return 'delay profile';
	}

	/**
	 * Override sync to handle single profile update to id=1
	 */
	override async sync(): Promise<SyncResult> {
		const syncConfig = arrSyncQueries.getDelayProfilesSync(this.instanceId);

		if (!syncConfig.databaseId || !syncConfig.profileName) {
			await logger.debug('No delay profile configured for sync', {
				source: 'Sync:DelayProfile',
				meta: { instanceId: this.instanceId }
			});
			return { success: true, itemsSynced: 0 };
		}

		const cache = getCache(syncConfig.databaseId);
		if (!cache) {
			await logger.warn(`PCD cache not found for database ${syncConfig.databaseId}`, {
				source: 'Sync:DelayProfile',
				meta: { instanceId: this.instanceId }
			});
			return { success: false, itemsSynced: 0, error: 'PCD cache not found' };
		}

		const profile = await getDelayProfileByName(cache, syncConfig.profileName);
		if (!profile) {
			await logger.warn(`Profile "${syncConfig.profileName}" not found`, {
				source: 'Sync:DelayProfile',
				meta: { instanceId: this.instanceId, profileName: syncConfig.profileName }
			});
			return { success: false, itemsSynced: 0, error: 'Profile not found in PCD' };
		}

		const transformed = transformDelayProfile(profile);
		await this.client.updateDelayProfile(1, transformed);

		await logger.info(`Synced delay profile "${profile.name}" to "${this.instanceName}"`, {
			source: 'Sync:DelayProfile',
			meta: { instanceId: this.instanceId }
		});

		return {
			success: true,
			itemsSynced: 1,
			items: [{ name: profile.name, action: 'updated' as const }]
		};
	}

	// Base class abstract methods - not used since we override sync()
	protected async fetchFromPcd(): Promise<unknown[]> {
		return [];
	}

	protected transformToArr(_pcdData: unknown[]): unknown[] {
		return [];
	}

	protected async pushToArr(_arrData: unknown[]): Promise<void> {}
}
