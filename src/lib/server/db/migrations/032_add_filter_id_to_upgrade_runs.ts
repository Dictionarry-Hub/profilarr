import type { Migration } from '#db/migrations.ts';

/**
 * Migration 032: Add filter_id to upgrade_runs table
 *
 * Replaces the cooldown_hours column with filter_id.
 * The cooldown system now uses filter-level tags instead of time-based cooldown.
 *
 * - Adds filter_id TEXT column to track which filter was used
 * - cooldown_hours is deprecated but kept for backwards compatibility
 */

export const migration: Migration = {
	version: 32,
	name: 'Add filter_id to upgrade_runs',

	up: `
		ALTER TABLE upgrade_runs ADD COLUMN filter_id TEXT NOT NULL DEFAULT '';
	`,

	down: `
		-- SQLite doesn't support dropping columns easily
		-- The column will remain but won't be used
		SELECT 1;
	`
};
