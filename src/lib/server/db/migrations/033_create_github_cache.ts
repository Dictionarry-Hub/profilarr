import type { Migration } from '#db/migrations.ts';

export const migration: Migration = {
	version: 33,
	name: 'Create GitHub cache table',

	up: `
		CREATE TABLE IF NOT EXISTS github_cache (
			cache_key TEXT PRIMARY KEY,
			cache_type TEXT NOT NULL,
			data TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			expires_at DATETIME NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_github_cache_type ON github_cache(cache_type);
		CREATE INDEX IF NOT EXISTS idx_github_cache_expires ON github_cache(expires_at);
	`,

	down: `
		DROP INDEX IF EXISTS idx_github_cache_expires;
		DROP INDEX IF EXISTS idx_github_cache_type;
		DROP TABLE IF EXISTS github_cache;
	`
};
