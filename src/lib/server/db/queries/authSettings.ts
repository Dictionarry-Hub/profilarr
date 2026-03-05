import { db } from '../db.ts';
import { generateApiKey } from '$auth/apiKey.ts';

/**
 * Types for auth_settings table
 */
export interface AuthSettings {
	id: number;
	session_duration_hours: number;
	api_key: string | null;
	created_at: string;
	updated_at: string;
}

export interface UpdateAuthSettingsInput {
	sessionDurationHours?: number;
	apiKey?: string | null;
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
	 * Get API key (may be null)
	 */
	getApiKey(): string | null {
		return this.get().api_key;
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
		if (input.apiKey !== undefined) {
			updates.push('api_key = ?');
			params.push(input.apiKey);
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
	},

	/**
	 * Regenerate API key and return the new key
	 */
	regenerateApiKey(): string {
		const newKey = generateApiKey();
		this.update({ apiKey: newKey });
		return newKey;
	},

	/**
	 * Clear API key (disable API access)
	 */
	clearApiKey(): boolean {
		return this.update({ apiKey: null });
	},

	/**
	 * Validate an API key
	 */
	validateApiKey(key: string): boolean {
		const settings = this.get();
		if (settings.api_key === null) return false;

		const encoder = new TextEncoder();
		const a = encoder.encode(key);
		const b = encoder.encode(settings.api_key);
		if (a.byteLength !== b.byteLength) return false;

		return crypto.subtle.timingSafeEqual(a, b);
	}
};
