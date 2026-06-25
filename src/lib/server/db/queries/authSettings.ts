import { db } from '../db.ts';
import { generateApiKey } from '$auth/apiKey.ts';
import { hash, verify } from '@felix/bcrypt';
import { config } from '$config';

/**
 * Types for auth_settings table
 */
export interface AuthSettings {
	id: number;
	session_duration_hours: number;
	api_key: string | null;
	local_bypass_enabled: number;
	created_at: string;
	updated_at: string;
}

export interface UpdateAuthSettingsInput {
	sessionDurationHours?: number;
	apiKey?: string | null;
}

export enum ApiKeySource {
	Environment = 'environment',
	Generated = 'generated'
}

export interface ApiKey {
	source: ApiKeySource;
	key: string | null;
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
	 * Check whether an API key is configured
	 */
	hasApiKey(): boolean {
		return config.profilarrApiKey !== null || this.get().api_key !== null;
	},

	/**
	 * Check whether users can regenerate the API key from the UI
	 */
	canRegenerateApiKey(): boolean {
		return config.profilarrApiKey === null;
	},

	/**
	 * Get the active API key and where it comes from.
	 */
	getApiKey(): ApiKey {
		if (config.profilarrApiKey !== null) {
			return { source: ApiKeySource.Environment, key: config.profilarrApiKey };
		}

		return { source: ApiKeySource.Generated, key: this.get().api_key };
	},

	/**
	 * Check if local bypass is enabled (skip auth for local IPs)
	 */
	isLocalBypassEnabled(): boolean {
		return this.get().local_bypass_enabled === 1;
	},

	/**
	 * Set local bypass toggle
	 */
	setLocalBypass(enabled: boolean): boolean {
		const affected = db.execute(
			'UPDATE auth_settings SET local_bypass_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
			enabled ? 1 : 0
		);
		return affected > 0;
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
	 * Regenerate API key — returns the plaintext key (stored as bcrypt hash)
	 */
	async regenerateApiKey(): Promise<string> {
		if (!this.canRegenerateApiKey()) {
			throw new Error('PROFILARR_API_KEY is set; API key regeneration is disabled');
		}

		const plaintext = generateApiKey();
		const hashed = await hash(plaintext);
		this.update({ apiKey: hashed });
		return plaintext;
	},

	/**
	 * Clear API key (disable API access)
	 */
	clearApiKey(): boolean {
		return this.update({ apiKey: null });
	},

	/**
	 * Validate an API key against the active source.
	 */
	async validateApiKey(key: string): Promise<boolean> {
		const activeKey = this.getApiKey();
		if (activeKey.key === null) return false;

		switch (activeKey.source) {
			case ApiKeySource.Environment:
				return key === activeKey.key;
			case ApiKeySource.Generated:
				return verify(key, activeKey.key);
		}
	}
};
