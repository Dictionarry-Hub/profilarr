/**
 * Sync module type definitions
 * Consolidates all sync infrastructure types
 */

import type { BaseArrClient } from '$arr/base.ts';
import type { ArrInstance } from '$db/queries/arrInstances.ts';

// =============================================================================
// SYNC RESULT TYPES
// =============================================================================

/**
 * A single item that was synced (created or updated)
 */
export interface SyncedItem {
	name: string;
	action: 'created' | 'updated';
}

/**
 * Result of a single sync operation
 */
export interface SyncResult {
	success: boolean;
	itemsSynced: number;
	error?: string;
	items?: SyncedItem[];
}

/**
 * Result of processing all pending syncs
 */
export interface ProcessSyncsResult {
	totalSynced: number;
	results: InstanceSyncResult[];
}

/**
 * Sync results for a single arr instance
 */
export interface InstanceSyncResult {
	instanceId: number;
	instanceName: string;
	qualityProfiles?: SyncResult;
	delayProfiles?: SyncResult;
	mediaManagement?: SyncResult;
}

// =============================================================================
// SECTION REGISTRY TYPES
// =============================================================================

/**
 * Supported sync section types
 */
export type SectionType = 'qualityProfiles' | 'delayProfiles' | 'mediaManagement';

/**
 * Scheduled sync configuration
 */
export interface ScheduledConfig {
	instanceId: number;
	cron: string | null;
	nextRunAt: string | null;
}

/**
 * Section handler interface
 * Each section type implements this to provide section-specific operations
 */
export interface SectionHandler {
	readonly type: SectionType;

	// Flag operations (legacy - uses should_sync)
	setShouldSync(instanceId: number, value: boolean): void;
	setNextRunAt(instanceId: number, nextRunAt: string | null): void;

	// Status operations (new - uses sync_status)
	claimSync(instanceId: number): boolean;
	completeSync(instanceId: number): void;
	failSync(instanceId: number, error: string): void;
	setStatusPending(instanceId: number): void;

	// Query operations
	getPendingInstanceIds(): number[];
	getScheduledConfigs(): ScheduledConfig[];

	// Syncer factory
	createSyncer(client: BaseArrClient, instance: ArrInstance): BaseSyncer;

	// Config check - returns true if this section has something to sync for the instance
	hasConfig(instanceId: number): boolean;
}

// =============================================================================
// EVENT TRIGGER TYPES
// =============================================================================

/**
 * Events that can trigger a sync
 */
export type SyncTriggerEvent = 'on_pull';

/**
 * Context for a sync trigger
 */
export interface TriggerContext {
	event: SyncTriggerEvent;
	databaseId?: number;
}

// =============================================================================
// BASE SYNCER (forward declaration for type reference)
// =============================================================================

/**
 * Abstract base syncer interface
 * Actual implementation is in base.ts
 */
export interface BaseSyncer {
	sync(): Promise<SyncResult>;
}
