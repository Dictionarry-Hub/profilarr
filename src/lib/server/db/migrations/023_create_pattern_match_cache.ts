import type { Migration } from '#db/migrations.ts';

export const migration: Migration = {
	version: 23,
	name: 'create_pattern_match_cache',
	up: `
		-- Cache for pattern match results
		-- Stores regex match results to avoid redundant computation
		-- Key is title, invalidated when patterns change (via patterns_hash)
		CREATE TABLE pattern_match_cache (
			title TEXT NOT NULL,                   -- Release title being matched
			patterns_hash TEXT NOT NULL,           -- Hash of all patterns (for invalidation)
			match_results TEXT NOT NULL,           -- JSON object: { pattern: boolean }
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (title, patterns_hash)
		);

		-- Index for cleanup queries by hash (delete old pattern sets)
		CREATE INDEX idx_pattern_match_cache_hash ON pattern_match_cache(patterns_hash);

		-- Index for potential cleanup queries by age
		CREATE INDEX idx_pattern_match_cache_created_at ON pattern_match_cache(created_at);
	`,
	down: `
		DROP INDEX IF EXISTS idx_pattern_match_cache_created_at;
		DROP INDEX IF EXISTS idx_pattern_match_cache_hash;
		DROP TABLE IF EXISTS pattern_match_cache;
	`
};
