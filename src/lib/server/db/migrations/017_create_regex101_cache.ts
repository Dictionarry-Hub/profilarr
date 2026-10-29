import type { Migration } from '#db/migrations.ts';

export const migration: Migration = {
	version: 17,
	name: 'Create regex101 cache table',

	up: `
		CREATE TABLE IF NOT EXISTS regex101_cache (
			regex101_id TEXT PRIMARY KEY,
			response TEXT NOT NULL,
			fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`,

	down: `
		DROP TABLE IF EXISTS regex101_cache;
	`
};
