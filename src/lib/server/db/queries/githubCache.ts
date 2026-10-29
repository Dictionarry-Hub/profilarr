import { db } from '#db/db.ts';

/**
 * Types for github_cache table
 */
export interface GitHubCache {
	cache_key: string;
	cache_type: string;
	data: string;
	created_at: string;
	expires_at: string;
}

export type GitHubCacheType = 'repo_info' | 'avatar' | 'releases';

/**
 * All queries for github_cache table
 */
export const githubCacheQueries = {
	/**
	 * Get cached data by key (returns null if expired)
	 */
	get(cacheKey: string): GitHubCache | null {
		const result = db.queryFirst<GitHubCache>(
			`SELECT * FROM github_cache
			 WHERE cache_key = ? AND julianday(expires_at) > julianday('now')`,
			cacheKey
		);
		return result ?? null;
	},

	/**
	 * Get cached data by key even if expired (for stale-while-revalidate)
	 */
	getStale(cacheKey: string): GitHubCache | null {
		const result = db.queryFirst<GitHubCache>(
			'SELECT * FROM github_cache WHERE cache_key = ?',
			cacheKey
		);
		return result ?? null;
	},

	/**
	 * Check if cached data is expired
	 */
	isExpired(cacheKey: string): boolean {
		const result = db.queryFirst<{ expired: number }>(
			`SELECT CASE WHEN julianday(expires_at) <= julianday('now') THEN 1 ELSE 0 END as expired
			 FROM github_cache WHERE cache_key = ?`,
			cacheKey
		);
		return result?.expired === 1;
	},

	/**
	 * Store data in cache with TTL (insert or replace)
	 */
	set(cacheKey: string, cacheType: GitHubCacheType, data: string, ttlMinutes: number): void {
		db.execute(
			`INSERT OR REPLACE INTO github_cache (cache_key, cache_type, data, expires_at)
			 VALUES (?, ?, ?, datetime('now', '+' || ? || ' minutes'))`,
			cacheKey,
			cacheType,
			data,
			ttlMinutes
		);
	},

	/**
	 * Delete a cached entry
	 */
	delete(cacheKey: string): boolean {
		const affected = db.execute('DELETE FROM github_cache WHERE cache_key = ?', cacheKey);
		return affected > 0;
	},

	/**
	 * Delete all expired entries
	 */
	deleteExpired(): number {
		return db.execute("DELETE FROM github_cache WHERE julianday(expires_at) <= julianday('now')");
	},

	/**
	 * Clear all cached entries
	 */
	clear(): number {
		return db.execute('DELETE FROM github_cache');
	},

	/**
	 * Invalidate all entries of a specific type
	 */
	invalidateByType(cacheType: GitHubCacheType): number {
		return db.execute('DELETE FROM github_cache WHERE cache_type = ?', cacheType);
	}
};
