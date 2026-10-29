import { db } from '#db/db.ts';

/**
 * Types for setup_state table
 */
export interface SetupState {
	id: number;
	default_database_linked: number;
	created_at: string;
	updated_at: string;
}

/**
 * All queries for setup_state table
 * Singleton pattern - only one state record exists
 */
export const setupStateQueries = {
	/**
	 * Get setup state (singleton)
	 */
	get(): SetupState {
		const state = db.queryFirst<SetupState>('SELECT * FROM setup_state WHERE id = 1');
		if (!state) {
			throw new Error('Setup state not found - database may not be initialized');
		}
		return state;
	},

	/**
	 * Check if default database has been linked
	 */
	isDefaultDatabaseLinked(): boolean {
		return this.get().default_database_linked === 1;
	},

	/**
	 * Mark default database as linked
	 */
	markDefaultDatabaseLinked(): boolean {
		const affected = db.execute(
			'UPDATE setup_state SET default_database_linked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1'
		);
		return affected > 0;
	}
};
