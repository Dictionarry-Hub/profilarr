import { db } from '#db/db.ts';

/**
 * Types for regex101_cache table
 */
export interface Regex101Cache {
	regex101_id: string;
	response: string;
	fetched_at: string;
}

/**
 * All queries for regex101_cache table
 */
export const regex101CacheQueries = {
	/**
	 * Get cached response by regex101 ID
	 */
	get(regex101Id: string): Regex101Cache | undefined {
		return db.queryFirst<Regex101Cache>(
			'SELECT * FROM regex101_cache WHERE regex101_id = ?',
			regex101Id
		);
	},

	/**
	 * Store response in cache (insert or replace)
	 */
	set(regex101Id: string, response: string): void {
		db.execute(
			'INSERT OR REPLACE INTO regex101_cache (regex101_id, response) VALUES (?, ?)',
			regex101Id,
			response
		);
	},

	/**
	 * Delete a cached entry
	 */
	delete(regex101Id: string): boolean {
		const affected = db.execute('DELETE FROM regex101_cache WHERE regex101_id = ?', regex101Id);
		return affected > 0;
	},

	/**
	 * Clear all cached entries
	 */
	clear(): number {
		return db.execute('DELETE FROM regex101_cache');
	}
};
