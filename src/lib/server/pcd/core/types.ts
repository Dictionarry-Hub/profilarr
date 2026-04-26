/**
 * PCD Core Types
 * Consolidated type definitions for the PCD system
 */

import type { CompiledQuery } from 'kysely';

// ============================================================================
// OPERATION TYPES
// ============================================================================

/**
 * Which layer an operation belongs to
 */
export type OperationLayer = 'base' | 'user';

/**
 * Type of operation being performed
 */
export type OperationType = 'create' | 'update' | 'delete';

/**
 * Writable layers (excludes schema which is read-only)
 */
export type WritableLayer = 'base' | 'tweaks' | 'user';

/**
 * A loaded SQL operation from disk
 */
export interface Operation {
	filename: string;
	filepath: string;
	sql: string;
	order: number;
	layer: 'schema' | 'base' | 'tweaks' | 'user';
}

/**
 * Metadata for an operation - used for optimization and tracking
 */
export interface OperationMetadata {
	/** The type of operation */
	operation: OperationType;
	/** The entity type (e.g., 'delay_profile', 'quality_profile') */
	entity: string;
	/** The entity name (current name for create/update, name being deleted for delete) */
	name: string;
	/** Previous name if this is a rename operation */
	previousName?: string;
	/** Stable key for locating the entity */
	stableKey?: { key: string; value: string };
	/** Group id for operations created as part of a single action */
	groupId?: string;
	/** Whether this operation was generated as a dependency */
	generated?: boolean;
	/** Dependencies required for this operation */
	dependsOn?: Array<{ entity: string; key: string; value: string }>;
	/** Fields changed by this operation */
	changedFields?: string[];
	/** Short summary for display */
	summary?: string;
	/** Human-friendly title for display */
	title?: string;
}

// ============================================================================
// CACHE TYPES
// ============================================================================

/**
 * Stats returned from cache build
 */
export interface CacheBuildStats {
	schema: number;
	base: number;
	tweaks: number;
	user: number;
	timing: number;
	needsRebuild?: boolean;
}

/**
 * Result of SQL validation
 */
export interface ValidationResult {
	valid: boolean;
	error?: string;
}

// ============================================================================
// WRITER TYPES
// ============================================================================

/**
 * Options for writing an operation
 */
export interface WriteOptions {
	/** The database instance ID */
	databaseId: number;
	/** Which layer to write to */
	layer: OperationLayer;
	/** Description for the operation (used in filename) */
	description: string;
	/** The compiled Kysely queries to write */
	queries: CompiledQuery[];
	/** Metadata for optimization and tracking */
	metadata?: OperationMetadata;
	/** Optional desired state payload for diff/UI */
	desiredState?: Record<string, unknown> | null;
	/** Skip cache recompile after write (caller must recompile manually) */
	skipRecompile?: boolean;
}

/**
 * Result of a write operation
 */
export interface WriteResult {
	success: boolean;
	filepath?: string;
	error?: string;
}

// ============================================================================
// MANAGER TYPES
// ============================================================================

/**
 * Options for linking a new PCD repository
 */
export interface LinkOptions {
	repositoryUrl: string;
	name: string;
	branch?: string;
	syncStrategy?: number;
	autoPull?: boolean;
	personalAccessToken?: string;
	localOpsEnabled?: boolean;
	gitUserName?: string;
	gitUserEmail?: string;
	conflictStrategy?: string;
}

/**
 * Result of syncing a PCD repository
 */
export interface SyncResult {
	success: boolean;
	commitsBehind: number;
	error?: string;
}

/**
 * What triggered a sync run, used for completion-log telemetry
 */
export type SyncTrigger = 'schedule' | 'manual-api' | 'manual-ui';
