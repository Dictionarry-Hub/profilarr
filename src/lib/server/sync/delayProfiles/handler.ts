/**
 * Delay profiles section handler
 */

import { arrSyncQueries } from '#db/queries/arrSync.ts';
import type { BaseArrClient } from '#arr/base.ts';
import type { ArrInstance } from '#db/queries/arrInstances.ts';
import { DelayProfileSyncer } from './syncer.ts';
import {
	registerSection,
	type SectionHandler,
	type ScheduledConfig
} from '#server/sync/registry.ts';

export const delayProfilesHandler: SectionHandler = {
	type: 'delayProfiles',

	setShouldSync(instanceId: number, value: boolean): void {
		arrSyncQueries.setDelayProfilesShouldSync(instanceId, value);
	},

	setNextRunAt(instanceId: number, nextRunAt: string | null): void {
		arrSyncQueries.setDelayProfilesNextRunAt(instanceId, nextRunAt);
	},

	claimSync(instanceId: number): boolean {
		return arrSyncQueries.claimDelayProfilesSync(instanceId);
	},

	completeSync(instanceId: number): void {
		arrSyncQueries.completeDelayProfilesSync(instanceId);
	},

	failSync(instanceId: number, error: string): void {
		arrSyncQueries.failDelayProfilesSync(instanceId, error);
	},

	setStatusPending(instanceId: number): void {
		arrSyncQueries.setDelayProfilesStatusPending(instanceId);
	},

	getPendingInstanceIds(): number[] {
		return arrSyncQueries.getPendingSyncs().delayProfiles;
	},

	getScheduledConfigs(): ScheduledConfig[] {
		return arrSyncQueries.getScheduledConfigs().delayProfiles;
	},

	createSyncer(client: BaseArrClient, instance: ArrInstance) {
		return new DelayProfileSyncer(client, instance.id, instance.name);
	},

	hasConfig(instanceId: number): boolean {
		const config = arrSyncQueries.getDelayProfilesSync(instanceId);
		return config.databaseId !== null && config.profileName !== null;
	}
};

// Register on import
registerSection(delayProfilesHandler);
