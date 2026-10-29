import type { Migration } from '#db/migrations.ts';

/**
 * Migration 035: Add 'skipped' status to job_runs
 *
 * Adds a third status option for job runs that executed but had nothing to do.
 * This allows filtering out "noise" from periodic jobs that poll but find nothing.
 *
 * SQLite doesn't support ALTER TABLE to modify CHECK constraints, so we need to:
 * 1. Create a new table with the updated constraint
 * 2. Copy data from old table
 * 3. Drop old table
 * 4. Rename new table
 */

export const migration: Migration = {
	version: 35,
	name: 'Add skipped status to job_runs',

	up: `
		-- Create new table with updated CHECK constraint
		CREATE TABLE job_runs_new (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			job_id INTEGER NOT NULL,
			status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'skipped')),
			started_at DATETIME NOT NULL,
			finished_at DATETIME NOT NULL,
			duration_ms INTEGER NOT NULL,
			error TEXT,
			output TEXT,
			FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
		);

		-- Copy existing data
		INSERT INTO job_runs_new (id, job_id, status, started_at, finished_at, duration_ms, error, output)
		SELECT id, job_id, status, started_at, finished_at, duration_ms, error, output
		FROM job_runs;

		-- Drop old table
		DROP TABLE job_runs;

		-- Rename new table
		ALTER TABLE job_runs_new RENAME TO job_runs;

		-- Recreate indexes
		CREATE INDEX idx_job_runs_job_id ON job_runs(job_id);
		CREATE INDEX idx_job_runs_started_at ON job_runs(started_at);
		CREATE INDEX idx_job_runs_status ON job_runs(status);
	`,

	down: `
		-- Create old table with original CHECK constraint
		CREATE TABLE job_runs_old (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			job_id INTEGER NOT NULL,
			status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
			started_at DATETIME NOT NULL,
			finished_at DATETIME NOT NULL,
			duration_ms INTEGER NOT NULL,
			error TEXT,
			output TEXT,
			FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
		);

		-- Copy data (convert 'skipped' to 'success' for backwards compatibility)
		INSERT INTO job_runs_old (id, job_id, status, started_at, finished_at, duration_ms, error, output)
		SELECT id, job_id,
			CASE WHEN status = 'skipped' THEN 'success' ELSE status END,
			started_at, finished_at, duration_ms, error, output
		FROM job_runs;

		-- Drop new table
		DROP TABLE job_runs;

		-- Rename old table
		ALTER TABLE job_runs_old RENAME TO job_runs;

		-- Recreate original indexes
		CREATE INDEX idx_job_runs_job_id ON job_runs(job_id);
		CREATE INDEX idx_job_runs_started_at ON job_runs(started_at);
	`
};
