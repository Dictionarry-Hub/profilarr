import type { Migration } from '#db/migrations.ts';

export const migration: Migration = {
	version: 21,
	name: 'create_parsed_release_cache',
	up: `
		-- Cache for parsed release titles
		-- Stores parser microservice responses to avoid redundant HTTP calls
		-- Used by both custom format testing and quality profile entity testing
		CREATE TABLE parsed_release_cache (
			cache_key TEXT PRIMARY KEY,           -- "{title}:{type}" e.g. "Movie.2024.1080p.WEB-DL:movie"
			parser_version TEXT NOT NULL,         -- Parser version when cached (for invalidation)
			parsed_result TEXT NOT NULL,          -- Full JSON ParseResult from parser
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Index for cleanup queries by version (delete old versions)
		CREATE INDEX idx_parsed_release_cache_version ON parsed_release_cache(parser_version);

		-- Index for potential cleanup queries by age
		CREATE INDEX idx_parsed_release_cache_created_at ON parsed_release_cache(created_at);
	`,
	down: `
		DROP INDEX IF EXISTS idx_parsed_release_cache_created_at;
		DROP INDEX IF EXISTS idx_parsed_release_cache_version;
		DROP TABLE IF EXISTS parsed_release_cache;
	`
};
