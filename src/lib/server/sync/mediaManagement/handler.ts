/**
 * Media management section handler
 */

import { arrSyncQueries } from '$db/queries/arrSync.ts';
import type { BaseArrClient } from '$arr/base.ts';
import type { ArrInstance } from '$db/queries/arrInstances.ts';
import { MediaManagementSyncer } from './syncer.ts';
import type { ArrType } from '$arr/types.ts';
import { registerSection, type SectionHandler, type ScheduledConfig } from '../registry.ts';

export const mediaManagementHandler: SectionHandler = {
	type: 'mediaManagement',

	setShouldSync(instanceId: number, value: boolean): void {
		arrSyncQueries.setMediaManagementShouldSync(instanceId, value);
	},

	setNextRunAt(instanceId: number, nextRunAt: string | null): void {
		arrSyncQueries.setMediaManagementNextRunAt(instanceId, nextRunAt);
	},

	claimSync(instanceId: number): boolean {
		return arrSyncQueries.claimMediaManagementSync(instanceId);
	},

	completeSync(instanceId: number): void {
		arrSyncQueries.completeMediaManagementSync(instanceId);
	},

	failSync(instanceId: number, error: string): void {
		arrSyncQueries.failMediaManagementSync(instanceId, error);
	},

	setStatusPending(instanceId: number): void {
		arrSyncQueries.setMediaManagementStatusPending(instanceId);
	},

	getPendingInstanceIds(): number[] {
		return arrSyncQueries.getPendingSyncs().mediaManagement;
	},

	getScheduledConfigs(): ScheduledConfig[] {
		return arrSyncQueries.getScheduledConfigs().mediaManagement;
	},

	createSyncer(client: BaseArrClient, instance: ArrInstance) {
		return new MediaManagementSyncer(client, instance.id, instance.name, instance.type as ArrType);
	},

	hasConfig(instanceId: number): boolean {
		const config = arrSyncQueries.getMediaManagementSync(instanceId);
		return (
			config.namingDatabaseId !== null ||
			config.qualityDefinitionsDatabaseId !== null ||
			config.mediaSettingsDatabaseId !== null
		);
	}
};

// Register on import
registerSection(mediaManagementHandler);
