import { db } from '#db/db.ts';

/**
 * Types for ai_settings table
 */
export interface AISettings {
	id: number;
	enabled: number;
	api_url: string;
	api_key: string;
	model: string;
	created_at: string;
	updated_at: string;
}

export interface UpdateAISettingsInput {
	enabled?: boolean;
	apiUrl?: string;
	apiKey?: string;
	model?: string;
}

/**
 * All queries for ai_settings table
 * Singleton pattern - only one settings record exists
 */
export const aiSettingsQueries = {
	/**
	 * Get the AI settings (singleton)
	 */
	get(): AISettings | undefined {
		return db.queryFirst<AISettings>('SELECT * FROM ai_settings WHERE id = 1');
	},

	/**
	 * Update AI settings
	 */
	update(input: UpdateAISettingsInput): boolean {
		const updates: string[] = [];
		const params: (string | number)[] = [];

		if (input.enabled !== undefined) {
			updates.push('enabled = ?');
			params.push(input.enabled ? 1 : 0);
		}
		if (input.apiUrl !== undefined) {
			updates.push('api_url = ?');
			params.push(input.apiUrl);
		}
		if (input.apiKey !== undefined) {
			updates.push('api_key = ?');
			params.push(input.apiKey);
		}
		if (input.model !== undefined) {
			updates.push('model = ?');
			params.push(input.model);
		}

		if (updates.length === 0) {
			return false;
		}

		// Add updated_at
		updates.push('updated_at = CURRENT_TIMESTAMP');
		params.push(1); // id is always 1

		const affected = db.execute(
			`UPDATE ai_settings SET ${updates.join(', ')} WHERE id = ?`,
			...params
		);

		return affected > 0;
	},

	/**
	 * Reset AI settings to defaults
	 */
	reset(): boolean {
		const affected = db.execute(`
			UPDATE ai_settings SET
				enabled = 0,
				api_url = 'https://api.openai.com/v1',
				api_key = '',
				model = 'gpt-4o-mini',
				updated_at = CURRENT_TIMESTAMP
			WHERE id = 1
		`);

		return affected > 0;
	}
};
