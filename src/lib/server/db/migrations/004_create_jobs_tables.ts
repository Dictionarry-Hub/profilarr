import type { Migration } from '#db/migrations.ts';

/**
 * Migration 004: Create jobs and job_runs tables
 *
 * Creates tables for the job scheduling system:
 * - jobs: Stores job definitions and schedules
 * - job_runs: Stores execution history for each job
 */

export const migration: Migration = {
	version: 4,
	name: 'Create jobs and job_runs tables',

	up: `
		-- Jobs table (job definitions)
		CREATE TABLE jobs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			-- Job identification
			name TEXT NOT NULL UNIQUE,
			description TEXT,

			-- Scheduling
			schedule TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 1,

			-- Execution tracking
			last_run_at DATETIME,
			next_run_at DATETIME,

			-- Metadata
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Job runs table (execution history)
		CREATE TABLE job_runs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			-- Foreign key to jobs
			job_id INTEGER NOT NULL,

			-- Execution status
			status TEXT NOT NULL CHECK (status IN ('success', 'failure')),

			-- Timing
			started_at DATETIME NOT NULL,
			finished_at DATETIME NOT NULL,
			duration_ms INTEGER NOT NULL,

			-- Output
			error TEXT,
			output TEXT,

			FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
		);

		-- Create indexes for performance
		CREATE INDEX idx_jobs_enabled ON jobs(enabled);
		CREATE INDEX idx_jobs_next_run ON jobs(next_run_at);
		CREATE INDEX idx_job_runs_job_id ON job_runs(job_id);
		CREATE INDEX idx_job_runs_started_at ON job_runs(started_at);
	`,

	down: `
		DROP INDEX IF EXISTS idx_job_runs_started_at;
		DROP INDEX IF EXISTS idx_job_runs_job_id;
		DROP INDEX IF EXISTS idx_jobs_next_run;
		DROP INDEX IF EXISTS idx_jobs_enabled;
		DROP TABLE IF EXISTS job_runs;
		DROP TABLE IF EXISTS jobs;
	`
};
