/**
 * Types for the rename processing system
 */

import type { RenamePreviewItem } from '$lib/server/utils/arr/types.ts';

/**
 * Item that needs to be renamed
 * Contains the preview info plus metadata
 */
export interface RenameItem {
	id: number; // movieId or seriesId
	title: string;
	previews: RenamePreviewItem[];
}

// =========================================================================
// Snapshot types for before/after diffing
// =========================================================================

/** Snapshot of a single entity's current state on disk */
export interface EntitySnapshot {
	id: number;
	title: string;
	folderPath: string;
	files: { id: number; relativePath: string }[];
}

/** Full library snapshot keyed by entity ID */
export type LibrarySnapshot = Map<number, EntitySnapshot>;

/**
 * Structured log for each rename run
 * Contains all metrics and details about what happened
 */
export interface RenameJobLog {
	id: string; // UUID
	instanceId: number;
	instanceName: string;
	instanceType: 'radarr' | 'sonarr';
	startedAt: string;
	completedAt: string;
	status: 'success' | 'partial' | 'failed' | 'skipped';

	config: {
		dryRun: boolean;
		renameFolders: boolean;
		ignoreTag: string | null;
		manual: boolean;
	};

	library: {
		totalItems: number;
		fetchDurationMs: number;
	};

	filtering: {
		afterIgnoreTag: number; // Items remaining after filtering out ignored tag
		skippedByTag: number; // Items skipped due to ignore tag
	};

	results: {
		// File renames
		filesNeedingRename: number;
		filesRenamed: number;
		// Folder renames (if enabled)
		foldersRenamed: number;
		// Command tracking
		commandsTriggered: number;
		commandsCompleted: number;
		commandsFailed: number;
		errors: string[];
	};

	// Items that were renamed (for notification details)
	renamedItems: {
		id: number;
		title: string;
		folder?: { existingPath: string; newPath: string };
		files: { existingPath: string; newPath: string }[];
		imageUrl?: string;
	}[];
}

/**
 * Result from processing a single rename config
 */
export interface RenameProcessResult {
	success: boolean;
	log: RenameJobLog;
	error?: string;
}
