import type { Migration } from '../migrations.ts';

/**
 * Migration 065: Create Arr drift tables
 *
 * Stores per-instance drift scheduling config and the latest drift result.
 */

export const migration: Migration = {
	version: 65,
	name: 'Create Arr drift tables',

	up: `
		CREATE TABLE arr_drift_settings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			arr_instance_id INTEGER NOT NULL UNIQUE,
			enabled INTEGER NOT NULL DEFAULT 0,
			cron TEXT NOT NULL DEFAULT '0 0 * * *',
			next_run_at TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (arr_instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_arr_drift_settings_instance ON arr_drift_settings(arr_instance_id);

		CREATE TABLE arr_drift_status (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			arr_instance_id INTEGER NOT NULL UNIQUE,
			status TEXT NOT NULL DEFAULT 'never_checked' CHECK (
				status IN ('never_checked', 'clean', 'drift_detected', 'failed')
			),
			last_checked_at TEXT,
			counts_json TEXT NOT NULL DEFAULT '{}',
			diff_json TEXT NOT NULL DEFAULT '{}',
			diff_hash TEXT,
			last_notified_hash TEXT,
			last_notified_at TEXT,
			last_error TEXT,
			error_hash TEXT,
			last_notified_error_hash TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (arr_instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_arr_drift_status_instance ON arr_drift_status(arr_instance_id);
	`,

	down: `
		DROP INDEX IF EXISTS idx_arr_drift_status_instance;
		DROP TABLE IF EXISTS arr_drift_status;

		DROP INDEX IF EXISTS idx_arr_drift_settings_instance;
		DROP TABLE IF EXISTS arr_drift_settings;
	`
};
