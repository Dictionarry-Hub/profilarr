import type { Migration } from '#db/migrations.ts';

/**
 * Migration 027: Create rename_runs table
 *
 * Creates the table for storing rename run history.
 * Similar to upgrade_runs but with rename-specific fields.
 *
 * Fields:
 * - id: UUID primary key
 * - instance_id: Foreign key to arr_instances
 * - started_at, completed_at: Timestamps for the run
 * - status: success, partial, failed, skipped
 * - dry_run: Whether this was a dry run
 * - manual: Whether this was manually triggered
 *
 * Config snapshot:
 * - rename_folders, ignore_tag
 *
 * Stats (flat for easy querying):
 * - library_total, after_ignore_tag, skipped_by_tag
 * - files_needing_rename, files_renamed, folders_renamed
 * - commands_triggered, commands_completed, commands_failed
 *
 * Complex data as JSON:
 * - items: Array of renamed items with file paths
 * - errors: Array of error strings
 */

export const migration: Migration = {
	version: 27,
	name: 'Create rename_runs table',

	up: `
		CREATE TABLE rename_runs (
			id TEXT PRIMARY KEY,

			-- Relationship
			instance_id INTEGER NOT NULL,

			-- Timing
			started_at TEXT NOT NULL,
			completed_at TEXT NOT NULL,

			-- Status
			status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'skipped')),
			dry_run INTEGER NOT NULL DEFAULT 1,
			manual INTEGER NOT NULL DEFAULT 0,

			-- Config snapshot
			rename_folders INTEGER NOT NULL DEFAULT 0,
			ignore_tag TEXT,

			-- Library stats
			library_total INTEGER NOT NULL,
			library_fetch_ms INTEGER NOT NULL,

			-- Filtering stats
			after_ignore_tag INTEGER NOT NULL,
			skipped_by_tag INTEGER NOT NULL,

			-- Results stats
			files_needing_rename INTEGER NOT NULL,
			files_renamed INTEGER NOT NULL,
			folders_renamed INTEGER NOT NULL,
			commands_triggered INTEGER NOT NULL,
			commands_completed INTEGER NOT NULL,
			commands_failed INTEGER NOT NULL,

			-- Complex data as JSON
			items TEXT NOT NULL DEFAULT '[]',
			errors TEXT NOT NULL DEFAULT '[]',

			-- Metadata
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_rename_runs_instance ON rename_runs(instance_id);
		CREATE INDEX idx_rename_runs_started_at ON rename_runs(started_at DESC);
		CREATE INDEX idx_rename_runs_status ON rename_runs(status);
	`,

	down: `
		DROP INDEX IF EXISTS idx_rename_runs_status;
		DROP INDEX IF EXISTS idx_rename_runs_started_at;
		DROP INDEX IF EXISTS idx_rename_runs_instance;
		DROP TABLE IF EXISTS rename_runs;
	`
};
