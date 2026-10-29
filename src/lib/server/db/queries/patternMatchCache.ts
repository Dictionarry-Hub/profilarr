import { db } from '#db/db.ts';

/**
 * Types for pattern_match_cache table
 */
export interface PatternMatchCache {
	title: string;
	patterns_hash: string;
	match_results: string;
	created_at: string;
}

/**
 * All queries for pattern_match_cache table
 */
export const patternMatchCacheQueries = {
	/**
	 * Get cached match results for a title with specific patterns hash
	 */
	get(title: string, patternsHash: string): PatternMatchCache | undefined {
		return db.queryFirst<PatternMatchCache>(
			'SELECT * FROM pattern_match_cache WHERE title = ? AND patterns_hash = ?',
			title,
			patternsHash
		);
	},

	/**
	 * Get cached match results for multiple titles with specific patterns hash
	 * Returns a map of title -> match_results JSON
	 */
	getBatch(titles: string[], patternsHash: string): Map<string, string> {
		if (titles.length === 0) return new Map();

		const placeholders = titles.map(() => '?').join(',');
		const results = db.query<PatternMatchCache>(
			`SELECT title, match_results FROM pattern_match_cache WHERE patterns_hash = ? AND title IN (${placeholders})`,
			patternsHash,
			...titles
		);

		const map = new Map<string, string>();
		for (const row of results) {
			map.set(row.title, row.match_results);
		}
		return map;
	},

	/**
	 * Store match results in cache (insert or replace)
	 */
	set(title: string, patternsHash: string, matchResults: string): void {
		db.execute(
			'INSERT OR REPLACE INTO pattern_match_cache (title, patterns_hash, match_results) VALUES (?, ?, ?)',
			title,
			patternsHash,
			matchResults
		);
	},

	/**
	 * Store multiple match results in cache (batch insert)
	 */
	setBatch(entries: Array<{ title: string; matchResults: string }>, patternsHash: string): void {
		if (entries.length === 0) return;

		// Use a transaction for batch insert
		const stmt = db.prepare(
			'INSERT OR REPLACE INTO pattern_match_cache (title, patterns_hash, match_results) VALUES (?, ?, ?)'
		);

		try {
			for (const entry of entries) {
				stmt.run(entry.title, patternsHash, entry.matchResults);
			}
		} finally {
			stmt.finalize();
		}
	},

	/**
	 * Delete all entries for old pattern hashes
	 * Call this periodically to clean up stale cache entries
	 */
	deleteOldHashes(currentHash: string): number {
		return db.execute('DELETE FROM pattern_match_cache WHERE patterns_hash != ?', currentHash);
	},

	/**
	 * Clear all cached entries
	 */
	clear(): number {
		return db.execute('DELETE FROM pattern_match_cache');
	},

	/**
	 * Get cache stats
	 */
	getStats(): { total: number; byHash: Record<string, number> } {
		const total =
			db.queryFirst<{ count: number }>('SELECT COUNT(*) as count FROM pattern_match_cache')
				?.count ?? 0;

		const hashCounts = db.query<{ patterns_hash: string; count: number }>(
			'SELECT patterns_hash, COUNT(*) as count FROM pattern_match_cache GROUP BY patterns_hash'
		);

		const byHash: Record<string, number> = {};
		for (const row of hashCounts) {
			byHash[row.patterns_hash] = row.count;
		}

		return { total, byHash };
	}
};
