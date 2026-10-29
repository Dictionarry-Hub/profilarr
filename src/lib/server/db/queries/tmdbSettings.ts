import { db } from '#db/db.ts';

/**
 * Types for tmdb_settings table
 */
export interface TMDBSettings {
	id: number;
	api_key: string;
	created_at: string;
	updated_at: string;
}

export interface UpdateTMDBSettingsInput {
	apiKey?: string;
}

/**
 * All queries for tmdb_settings table
 * Singleton pattern - only one settings record exists
 */
export const tmdbSettingsQueries = {
	/**
	 * Get the TMDB settings (singleton)
	 */
	get(): TMDBSettings | undefined {
		return db.queryFirst<TMDBSettings>('SELECT * FROM tmdb_settings WHERE id = 1');
	},

	/**
	 * Update TMDB settings
	 */
	update(input: UpdateTMDBSettingsInput): boolean {
		const updates: string[] = [];
		const params: (string | number)[] = [];

		if (input.apiKey !== undefined) {
			updates.push('api_key = ?');
			params.push(input.apiKey);
		}

		if (updates.length === 0) {
			return false;
		}

		// Add updated_at
		updates.push('updated_at = CURRENT_TIMESTAMP');
		params.push(1); // id is always 1

		const affected = db.execute(
			`UPDATE tmdb_settings SET ${updates.join(', ')} WHERE id = ?`,
			...params
		);

		return affected > 0;
	},

	/**
	 * Reset TMDB settings to defaults
	 */
	reset(): boolean {
		const affected = db.execute(`
			UPDATE tmdb_settings SET
				api_key = '',
				updated_at = CURRENT_TIMESTAMP
			WHERE id = 1
		`);

		return affected > 0;
	}
};
