import type { Migration } from '#db/migrations.ts';

/**
 * Migration 049: Create job_queue and job_run_history tables
 * - job_queue: stores scheduled and manual job instances
 * - job_run_history: stores execution history for job instances
 */
export const migration: Migration = {
	version: 49,
	name: 'Create job queue tables',
	up: `
		CREATE TABLE job_queue (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			job_type TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'queued',
			run_at TEXT NOT NULL,
			payload TEXT NOT NULL DEFAULT '{}',
			source TEXT NOT NULL DEFAULT 'system',
			dedupe_key TEXT,
			cooldown_until TEXT,
			attempts INTEGER NOT NULL DEFAULT 0,
			started_at TEXT,
			finished_at TEXT,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE job_run_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			queue_id INTEGER,
			job_type TEXT NOT NULL,
			status TEXT NOT NULL,
			started_at TEXT NOT NULL,
			finished_at TEXT NOT NULL,
			duration_ms INTEGER NOT NULL,
			error TEXT,
			output TEXT,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (queue_id) REFERENCES job_queue(id) ON DELETE SET NULL
		);

		CREATE UNIQUE INDEX idx_job_queue_dedupe_key ON job_queue(dedupe_key) WHERE dedupe_key IS NOT NULL;
		CREATE INDEX idx_job_queue_status_run_at ON job_queue(status, run_at);
		CREATE INDEX idx_job_queue_run_at ON job_queue(run_at);
		CREATE INDEX idx_job_run_history_queue_id ON job_run_history(queue_id);
		CREATE INDEX idx_job_run_history_started_at ON job_run_history(started_at);
		CREATE INDEX idx_job_run_history_status ON job_run_history(status);
	`,
	down: `
		DROP INDEX IF EXISTS idx_job_run_history_status;
		DROP INDEX IF EXISTS idx_job_run_history_started_at;
		DROP INDEX IF EXISTS idx_job_run_history_queue_id;
		DROP INDEX IF EXISTS idx_job_queue_run_at;
		DROP INDEX IF EXISTS idx_job_queue_status_run_at;
		DROP INDEX IF EXISTS idx_job_queue_dedupe_key;
		DROP TABLE IF EXISTS job_run_history;
		DROP TABLE IF EXISTS job_queue;
	`
};
