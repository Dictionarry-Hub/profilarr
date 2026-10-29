import { db } from '#db/db.ts';

/**
 * Types for log_settings table
 */
export interface LogSettings {
	id: number;
	retention_days: number;
	min_level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
	enabled: number;
	file_logging: number;
	console_logging: number;
	created_at: string;
	updated_at: string;
}

export interface UpdateLogSettingsInput {
	retentionDays?: number;
	minLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
	enabled?: boolean;
	fileLogging?: boolean;
	consoleLogging?: boolean;
}

/**
 * All queries for log_settings table
 * Singleton pattern - only one settings record exists
 */
export const logSettingsQueries = {
	/**
	 * Get the log settings (singleton)
	 */
	get(): LogSettings | undefined {
		return db.queryFirst<LogSettings>('SELECT * FROM log_settings WHERE id = 1');
	},

	/**
	 * Update log settings
	 */
	update(input: UpdateLogSettingsInput): boolean {
		const updates: string[] = [];
		const params: (string | number)[] = [];

		if (input.retentionDays !== undefined) {
			updates.push('retention_days = ?');
			params.push(input.retentionDays);
		}
		if (input.minLevel !== undefined) {
			updates.push('min_level = ?');
			params.push(input.minLevel);
		}
		if (input.enabled !== undefined) {
			updates.push('enabled = ?');
			params.push(input.enabled ? 1 : 0);
		}
		if (input.fileLogging !== undefined) {
			updates.push('file_logging = ?');
			params.push(input.fileLogging ? 1 : 0);
		}
		if (input.consoleLogging !== undefined) {
			updates.push('console_logging = ?');
			params.push(input.consoleLogging ? 1 : 0);
		}

		if (updates.length === 0) {
			return false;
		}

		// Add updated_at
		updates.push('updated_at = CURRENT_TIMESTAMP');
		params.push(1); // id is always 1

		const affected = db.execute(
			`UPDATE log_settings SET ${updates.join(', ')} WHERE id = ?`,
			...params
		);

		return affected > 0;
	},

	/**
	 * Reset log settings to defaults
	 */
	reset(): boolean {
		const affected = db.execute(`
			UPDATE log_settings SET
				retention_days = 30,
				min_level = 'DEBUG',
				enabled = 1,
				file_logging = 1,
				console_logging = 1,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = 1
		`);

		return affected > 0;
	}
};
