import { db } from '#db/db.ts';

/**
 * Types for parsed_release_cache table
 */
export interface ParsedReleaseCache {
	cache_key: string;
	parser_version: string;
	parsed_result: string;
	created_at: string;
}

/**
 * All queries for parsed_release_cache table
 */
export const parsedReleaseCacheQueries = {
	/**
	 * Get cached parse result by key and version
	 * Returns undefined if not found or version doesn't match
	 */
	get(cacheKey: string, parserVersion: string): ParsedReleaseCache | undefined {
		return db.queryFirst<ParsedReleaseCache>(
			'SELECT * FROM parsed_release_cache WHERE cache_key = ? AND parser_version = ?',
			cacheKey,
			parserVersion
		);
	},

	/**
	 * Store parse result in cache (insert or replace)
	 */
	set(cacheKey: string, parserVersion: string, parsedResult: string): void {
		db.execute(
			'INSERT OR REPLACE INTO parsed_release_cache (cache_key, parser_version, parsed_result) VALUES (?, ?, ?)',
			cacheKey,
			parserVersion,
			parsedResult
		);
	},

	/**
	 * Delete a cached entry
	 */
	delete(cacheKey: string): boolean {
		const affected = db.execute('DELETE FROM parsed_release_cache WHERE cache_key = ?', cacheKey);
		return affected > 0;
	},

	/**
	 * Delete all entries for old parser versions
	 * Call this periodically or on startup to clean up stale cache entries
	 */
	deleteOldVersions(currentVersion: string): number {
		return db.execute('DELETE FROM parsed_release_cache WHERE parser_version != ?', currentVersion);
	},

	/**
	 * Clear all cached entries
	 */
	clear(): number {
		return db.execute('DELETE FROM parsed_release_cache');
	},

	/**
	 * Get cache stats
	 */
	getStats(): { total: number; byVersion: Record<string, number> } {
		const total =
			db.queryFirst<{ count: number }>('SELECT COUNT(*) as count FROM parsed_release_cache')
				?.count ?? 0;

		const versionCounts = db.query<{ parser_version: string; count: number }>(
			'SELECT parser_version, COUNT(*) as count FROM parsed_release_cache GROUP BY parser_version'
		);

		const byVersion: Record<string, number> = {};
		for (const row of versionCounts) {
			byVersion[row.parser_version] = row.count;
		}

		return { total, byVersion };
	}
};
