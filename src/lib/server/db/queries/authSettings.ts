import { db } from '../db.ts';

/**
 * Types for auth_settings table
 */
export interface AuthSettings {
	id: number;
	session_duration_hours: number;
	created_at: string;
	updated_at: string;
}

export interface UpdateAuthSettingsInput {
	sessionDurationHours?: number;
}

/**
 * All queries for auth_settings table
 * Singleton pattern - only one settings record exists
 */
export const authSettingsQueries = {
	/**
	 * Get auth settings (singleton)
	 */
	get(): AuthSettings {
		const settings = db.queryFirst<AuthSettings>('SELECT * FROM auth_settings WHERE id = 1');
		if (!settings) {
			throw new Error('Auth settings not found - database may not be initialized');
		}
		return settings;
	},

	/**
	 * Get session duration in hours
	 */
	getSessionDurationHours(): number {
		return this.get().session_duration_hours;
	},

	/**
	 * Update auth settings
	 */
	update(input: UpdateAuthSettingsInput): boolean {
		const updates: string[] = [];
		const params: (string | number | null)[] = [];

		if (input.sessionDurationHours !== undefined) {
			updates.push('session_duration_hours = ?');
			params.push(input.sessionDurationHours);
		}

		if (updates.length === 0) {
			return false;
		}

		updates.push('updated_at = CURRENT_TIMESTAMP');
		params.push(1); // id is always 1

		const affected = db.execute(
			`UPDATE auth_settings SET ${updates.join(', ')} WHERE id = ?`,
			...params
		);

		return affected > 0;
	}
};
