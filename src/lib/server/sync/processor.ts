/**
 * Sync processor
 * Processes pending syncs by creating syncer instances and running them
 *
 * Triggers:
 * - on_pull: Triggered directly via triggerSyncs() after database git pull completes
 * - schedule: Cron expressions evaluated by evaluateScheduledSyncs() before processing
 */

import { arrInstancesQueries, type ArrInstance } from '$db/queries/arrInstances.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { calculateNextRun } from './utils.ts';
import { createArrClient } from '$arr/factory.ts';
import type { ArrType } from '$arr/types.ts';
import { logger } from '$logger/logger.ts';
import { upsertScheduledJob } from '$lib/server/jobs/queueService.ts';
import type {
	SectionType,
	SectionHandler,
	ProcessSyncsResult,
	InstanceSyncResult,
	SyncTriggerEvent,
	TriggerContext
} from './types.ts';
// Import handlers to trigger registration
import './qualityProfiles/handler.ts';
import './delayProfiles/handler.ts';
import './mediaManagement/handler.ts';

import { getAllSections, getSection } from './registry.ts';

// Concurrency limit for parallel instance processing
const CONCURRENCY_LIMIT = 3;

export type { ProcessSyncsResult, InstanceSyncResult, SyncTriggerEvent, TriggerContext };

/**
 * Check if a scheduled config should trigger based on next_run_at
 * Returns true if:
 * - nextRunAt is null (first run / bootstrap)
 * - current time >= nextRunAt
 */
function shouldTrigger(nextRunAt: string | null): boolean {
	// Bootstrap case: no next_run_at set yet, trigger immediately
	if (!nextRunAt) return true;
	const now = new Date();
	const nextRun = new Date(nextRunAt);
	return now >= nextRun;
}

/**
 * Evaluate scheduled sync configs and mark matching ones for sync
 * Uses the section registry to reduce code duplication
 */
async function evaluateScheduledSyncs(): Promise<void> {
	const sections = getAllSections();
	let totalScheduled = 0;
	let marked = 0;

	// Gather all scheduled configs
	const scheduledBySection = new Map<
		SectionType,
		ReturnType<SectionHandler['getScheduledConfigs']>
	>();
	for (const handler of sections) {
		const configs = handler.getScheduledConfigs();
		scheduledBySection.set(handler.type, configs);
		totalScheduled += configs.length;
	}

	if (totalScheduled === 0) return;

	await logger.debug(`Evaluating ${totalScheduled} scheduled config(s)`, {
		source: 'SyncProcessor',
		meta: Object.fromEntries(
			[...scheduledBySection.entries()].map(([type, configs]) => [type, configs.length])
		)
	});

	// Process each section's scheduled configs
	for (const handler of sections) {
		const configs = scheduledBySection.get(handler.type) ?? [];
		for (const config of configs) {
			if (shouldTrigger(config.nextRunAt)) {
				// Use setStatusPending which sets both should_sync and sync_status
				handler.setStatusPending(config.instanceId);
				const nextRun = calculateNextRun(config.cron);
				handler.setNextRunAt(config.instanceId, nextRun);
				marked++;
			}
		}
	}

	if (marked > 0) {
		await logger.debug(`Marked ${marked} config(s) for sync based on schedule`, {
			source: 'SyncProcessor'
		});
	}
}

/**
 * Get all pending syncs grouped by instance
 * Returns a map of instanceId -> list of section types that need syncing
 */
function getPendingSyncsByInstance(): Map<number, SectionType[]> {
	const result = new Map<number, SectionType[]>();

	for (const handler of getAllSections()) {
		const instanceIds = handler.getPendingInstanceIds();
		for (const instanceId of instanceIds) {
			if (!result.has(instanceId)) {
				result.set(instanceId, []);
			}
			result.get(instanceId)!.push(handler.type);
		}
	}

	return result;
}

/**
 * Process a single instance's pending syncs
 * Sections are processed sequentially within an instance (dependency order matters)
 */
async function processInstanceSections(
	instance: ArrInstance,
	sectionTypes: SectionType[]
): Promise<InstanceSyncResult> {
	const instanceResult: InstanceSyncResult = {
		instanceId: instance.id,
		instanceName: instance.name
	};

	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key);

	// Process sections sequentially (quality profiles depend on custom formats being synced first)
	for (const sectionType of sectionTypes) {
		const handler = getSection(sectionType);

		// Atomically claim the sync (prevents double-processing)
		if (!handler.claimSync(instance.id)) {
			await logger.debug(`Sync for ${sectionType} already claimed, skipping`, {
				source: 'SyncProcessor',
				meta: { instanceId: instance.id, section: sectionType }
			});
			continue;
		}

		try {
			const syncer = handler.createSyncer(client, instance);
			const syncResult = await syncer.sync();

			// Store result on the instance result object
			instanceResult[sectionType] = syncResult;

			// Mark as complete or failed based on result
			if (syncResult.success) {
				handler.completeSync(instance.id);
			} else {
				handler.failSync(instance.id, syncResult.error ?? 'Unknown error');
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			handler.failSync(instance.id, errorMsg);
			await logger.error(`Failed to sync ${sectionType} for "${instance.name}"`, {
				source: 'SyncProcessor',
				meta: { instanceId: instance.id, section: sectionType, error: errorMsg }
			});
			instanceResult[sectionType] = { success: false, itemsSynced: 0, error: errorMsg };
		}
	}

	return instanceResult;
}

/**
 * Process items in batches with concurrency limit
 */
async function processBatches<T, R>(
	items: T[],
	processor: (item: T) => Promise<R>,
	concurrency: number
): Promise<R[]> {
	const results: R[] = [];

	for (let i = 0; i < items.length; i += concurrency) {
		const batch = items.slice(i, i + concurrency);
		const batchResults = await Promise.all(batch.map(processor));
		results.push(...batchResults);
	}

	return results;
}

/**
 * Process all pending syncs
 * Called by the sync job and directly via triggerSyncs()
 */
export async function processPendingSyncs(): Promise<ProcessSyncsResult> {
	// Evaluate scheduled configs and mark them for sync if cron matches
	await evaluateScheduledSyncs();

	const pendingByInstance = getPendingSyncsByInstance();

	if (pendingByInstance.size === 0) {
		await logger.debug('No pending syncs', { source: 'SyncProcessor' });
		return { totalSynced: 0, results: [] };
	}

	// Log pending counts
	const pendingCounts: Record<string, number> = {};
	for (const handler of getAllSections()) {
		pendingCounts[handler.type] = handler.getPendingInstanceIds().length;
	}

	await logger.info(`Processing syncs for ${pendingByInstance.size} instance(s)`, {
		source: 'SyncProcessor',
		meta: pendingCounts
	});

	// Prepare instance processing tasks
	const instanceTasks: Array<{ instance: ArrInstance; sectionTypes: SectionType[] }> = [];

	for (const [instanceId, sectionTypes] of pendingByInstance) {
		const instance = arrInstancesQueries.getById(instanceId);

		if (!instance) {
			await logger.warn(`Instance ${instanceId} not found, skipping sync`, {
				source: 'SyncProcessor'
			});
			continue;
		}

		if (!instance.enabled) {
			await logger.debug(`Instance "${instance.name}" is disabled, skipping sync`, {
				source: 'SyncProcessor'
			});
			continue;
		}

		instanceTasks.push({ instance, sectionTypes });
	}

	// Process instances in parallel with concurrency limit
	const results = await processBatches(
		instanceTasks,
		({ instance, sectionTypes }) => processInstanceSections(instance, sectionTypes),
		CONCURRENCY_LIMIT
	);

	// Calculate total synced
	let totalSynced = 0;
	for (const result of results) {
		if (result.qualityProfiles?.itemsSynced) totalSynced += result.qualityProfiles.itemsSynced;
		if (result.delayProfiles?.itemsSynced) totalSynced += result.delayProfiles.itemsSynced;
		if (result.mediaManagement?.itemsSynced) totalSynced += result.mediaManagement.itemsSynced;
	}

	await logger.info(`Sync processing complete`, {
		source: 'SyncProcessor',
		meta: { totalSynced, instanceCount: results.length }
	});

	return { totalSynced, results };
}

/**
 * Sync a specific instance manually
 * Syncs all configured sections regardless of should_sync flag
 */
export async function syncInstance(instanceId: number): Promise<InstanceSyncResult> {
	const instance = arrInstancesQueries.getById(instanceId);

	if (!instance) {
		throw new Error(`Instance ${instanceId} not found`);
	}

	await logger.info(`Manual sync triggered for "${instance.name}"`, {
		source: 'SyncProcessor',
		meta: { instanceId }
	});

	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key);
	const result: InstanceSyncResult = {
		instanceId,
		instanceName: instance.name
	};

	// Sync all sections that have configuration
	for (const handler of getAllSections()) {
		if (handler.hasConfig(instanceId)) {
			const syncer = handler.createSyncer(client, instance);
			result[handler.type] = await syncer.sync();
		}
	}

	return result;
}

// =============================================================================
// Event triggers
// =============================================================================

/**
 * Trigger syncs for configs matching the event type
 * Called from manager.ts after database git pull completes
 */
export async function triggerSyncs(context: TriggerContext): Promise<void> {
	await logger.debug(`Sync trigger: ${context.event}`, {
		source: 'SyncProcessor',
		meta: { databaseId: context.databaseId }
	});

	const instanceIds = arrSyncQueries.getInstanceIdsForTrigger(context.event);

	for (const instanceId of instanceIds) {
		const status = arrSyncQueries.getSyncConfigStatus(instanceId);

		if (status.qualityProfiles.trigger === context.event) {
			arrSyncQueries.setQualityProfilesStatusPending(instanceId);
			upsertScheduledJob({
				jobType: 'arr.sync.qualityProfiles',
				runAt: new Date().toISOString(),
				payload: { instanceId },
				source: 'system',
				dedupeKey: `arr.sync.qualityProfiles:event:${instanceId}`
			});
		}
		if (status.delayProfiles.trigger === context.event) {
			arrSyncQueries.setDelayProfilesStatusPending(instanceId);
			upsertScheduledJob({
				jobType: 'arr.sync.delayProfiles',
				runAt: new Date().toISOString(),
				payload: { instanceId },
				source: 'system',
				dedupeKey: `arr.sync.delayProfiles:event:${instanceId}`
			});
		}
		if (status.mediaManagement.trigger === context.event) {
			arrSyncQueries.setMediaManagementStatusPending(instanceId);
			upsertScheduledJob({
				jobType: 'arr.sync.mediaManagement',
				runAt: new Date().toISOString(),
				payload: { instanceId },
				source: 'system',
				dedupeKey: `arr.sync.mediaManagement:event:${instanceId}`
			});
		}
	}
}
