/**
 * Base syncer class
 * Provides common structure for syncing PCD data to arr instances
 */

import type { BaseArrClient } from '#arr/base.ts';
import { logger } from '#logger/logger.ts';
import type { SyncResult } from './types.ts';

export type { SyncResult };

/**
 * Abstract base class for syncers
 * Each syncer type (quality profiles, delay profiles, media management) extends this
 */
export abstract class BaseSyncer {
	protected client: BaseArrClient;
	protected instanceId: number;
	protected instanceName: string;

	constructor(client: BaseArrClient, instanceId: number, instanceName: string) {
		this.client = client;
		this.instanceId = instanceId;
		this.instanceName = instanceName;
	}

	/**
	 * Get the sync type name for logging
	 */
	protected abstract get syncType(): string;

	/**
	 * Fetch data from PCD based on sync config
	 */
	protected abstract fetchFromPcd(): Promise<unknown[]>;

	/**
	 * Transform PCD data to arr API format
	 */
	protected abstract transformToArr(pcdData: unknown[]): unknown[];

	/**
	 * Push transformed data to arr instance
	 */
	protected abstract pushToArr(arrData: unknown[]): Promise<void>;

	/**
	 * Main sync method - orchestrates fetch, transform, push
	 */
	async sync(): Promise<SyncResult> {
		try {
			await logger.info(`Starting ${this.syncType} sync for "${this.instanceName}"`, {
				source: 'Syncer',
				meta: { instanceId: this.instanceId, syncType: this.syncType }
			});

			// Fetch from PCD
			const pcdData = await this.fetchFromPcd();

			if (pcdData.length === 0) {
				await logger.debug(`No ${this.syncType} to sync for "${this.instanceName}"`, {
					source: 'Syncer',
					meta: { instanceId: this.instanceId }
				});
				return { success: true, itemsSynced: 0 };
			}

			// Transform to arr format
			const arrData = this.transformToArr(pcdData);

			// Push to arr
			await this.pushToArr(arrData);

			await logger.info(`Completed ${this.syncType} sync for "${this.instanceName}"`, {
				source: 'Syncer',
				meta: { instanceId: this.instanceId, itemsSynced: arrData.length }
			});

			return { success: true, itemsSynced: arrData.length };
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';

			await logger.error(`Failed ${this.syncType} sync for "${this.instanceName}"`, {
				source: 'Syncer',
				meta: { instanceId: this.instanceId, error: errorMsg }
			});

			return { success: false, itemsSynced: 0, error: errorMsg };
		}
	}
}
