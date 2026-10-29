import type { Migration } from '#db/migrations.ts';

/**
 * Add sync_status column to sync config tables
 * Replaces boolean should_sync flag with a status enum for atomic state transitions
 *
 * States:
 * - idle: No sync pending
 * - pending: Sync queued, waiting to be processed
 * - in_progress: Currently being synced (prevents double-processing)
 * - failed: Last sync failed (stored for visibility)
 */
export const migration: Migration = {
	version: 34,
	name: 'Add sync status columns',

	up: `
		-- Add sync_status to quality profiles config
		ALTER TABLE arr_sync_quality_profiles_config
			ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'idle';

		ALTER TABLE arr_sync_quality_profiles_config
			ADD COLUMN last_error TEXT;

		ALTER TABLE arr_sync_quality_profiles_config
			ADD COLUMN last_synced_at TEXT;

		-- Add sync_status to delay profiles config
		ALTER TABLE arr_sync_delay_profiles_config
			ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'idle';

		ALTER TABLE arr_sync_delay_profiles_config
			ADD COLUMN last_error TEXT;

		ALTER TABLE arr_sync_delay_profiles_config
			ADD COLUMN last_synced_at TEXT;

		-- Add sync_status to media management
		ALTER TABLE arr_sync_media_management
			ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'idle';

		ALTER TABLE arr_sync_media_management
			ADD COLUMN last_error TEXT;

		ALTER TABLE arr_sync_media_management
			ADD COLUMN last_synced_at TEXT;

		-- Migrate existing should_sync flags to sync_status
		UPDATE arr_sync_quality_profiles_config
			SET sync_status = CASE WHEN should_sync = 1 THEN 'pending' ELSE 'idle' END;

		UPDATE arr_sync_delay_profiles_config
			SET sync_status = CASE WHEN should_sync = 1 THEN 'pending' ELSE 'idle' END;

		UPDATE arr_sync_media_management
			SET sync_status = CASE WHEN should_sync = 1 THEN 'pending' ELSE 'idle' END;
	`,

	down: `
		-- SQLite doesn't support DROP COLUMN easily
		-- These columns will remain but be unused if rolled back
	`
};
