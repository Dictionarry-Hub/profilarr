import type { Migration } from '#db/migrations.ts';

/**
 * Migration 026: Create upgrade_runs table
 *
 * Creates the table for storing upgrade run history.
 * Replaces the previous approach of storing runs as DEBUG log entries.
 *
 * Fields:
 * - id: UUID primary key
 * - instance_id: Foreign key to arr_instances
 * - started_at, completed_at: Timestamps for the run
 * - status: success, partial, failed, skipped
 * - dry_run: Whether this was a dry run
 *
 * Config snapshot (flat for queryability):
 * - schedule, filter_mode, filter_name
 *
 * Stats (flat for easy querying and filtering):
 * - library_total, matched_count, after_cooldown, selected_count
 * - searches_triggered, successful, failed
 *
 * Complex data as JSON:
 * - items: Array of selection items with score comparisons
 * - errors: Array of error strings
 */

export const migration: Migration = {
	version: 26,
	name: 'Create upgrade_runs table',

	up: `
		CREATE TABLE upgrade_runs (
			id TEXT PRIMARY KEY,

			-- Relationship
			instance_id INTEGER NOT NULL,

			-- Timing
			started_at TEXT NOT NULL,
			completed_at TEXT NOT NULL,

			-- Status
			status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'skipped')),
			dry_run INTEGER NOT NULL DEFAULT 0,

			-- Config snapshot
			schedule INTEGER NOT NULL,
			filter_mode TEXT NOT NULL,
			filter_name TEXT NOT NULL,

			-- Library stats
			library_total INTEGER NOT NULL,
			library_cached INTEGER NOT NULL DEFAULT 0,
			library_fetch_ms INTEGER NOT NULL,

			-- Filter stats
			matched_count INTEGER NOT NULL,
			after_cooldown INTEGER NOT NULL,
			cooldown_hours INTEGER NOT NULL,
			dry_run_excluded INTEGER NOT NULL DEFAULT 0,

			-- Selection stats
			selection_method TEXT NOT NULL,
			selection_requested INTEGER NOT NULL,
			selected_count INTEGER NOT NULL,

			-- Results stats
			searches_triggered INTEGER NOT NULL,
			successful INTEGER NOT NULL,
			failed INTEGER NOT NULL,

			-- Complex data as JSON
			items TEXT NOT NULL DEFAULT '[]',
			errors TEXT NOT NULL DEFAULT '[]',

			-- Metadata
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_upgrade_runs_instance ON upgrade_runs(instance_id);
		CREATE INDEX idx_upgrade_runs_started_at ON upgrade_runs(started_at DESC);
		CREATE INDEX idx_upgrade_runs_status ON upgrade_runs(status);
	`,

	down: `
		DROP INDEX IF EXISTS idx_upgrade_runs_status;
		DROP INDEX IF EXISTS idx_upgrade_runs_started_at;
		DROP INDEX IF EXISTS idx_upgrade_runs_instance;
		DROP TABLE IF EXISTS upgrade_runs;
	`
};
