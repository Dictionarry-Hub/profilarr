import { db } from '#db/db.ts';

/**
 * Types for backup_settings table
 */
export interface BackupSettings {
	id: number;
	schedule: string;
	retention_days: number;
	enabled: number;
	include_database: number;
	compression_enabled: number;
	created_at: string;
	updated_at: string;
}

export interface UpdateBackupSettingsInput {
	schedule?: string;
	retentionDays?: number;
	enabled?: boolean;
	includeDatabase?: boolean;
	compressionEnabled?: boolean;
}

/**
 * All queries for backup_settings table
 * Singleton pattern - only one settings record exists
 */
export const backupSettingsQueries = {
	/**
	 * Get the backup settings (singleton)
	 */
	get(): BackupSettings | undefined {
		return db.queryFirst<BackupSettings>('SELECT * FROM backup_settings WHERE id = 1');
	},

	/**
	 * Update backup settings
	 */
	update(input: UpdateBackupSettingsInput): boolean {
		const updates: string[] = [];
		const params: (string | number)[] = [];

		if (input.schedule !== undefined) {
			updates.push('schedule = ?');
			params.push(input.schedule);
		}
		if (input.retentionDays !== undefined) {
			updates.push('retention_days = ?');
			params.push(input.retentionDays);
		}
		if (input.enabled !== undefined) {
			updates.push('enabled = ?');
			params.push(input.enabled ? 1 : 0);
		}
		if (input.includeDatabase !== undefined) {
			updates.push('include_database = ?');
			params.push(input.includeDatabase ? 1 : 0);
		}
		if (input.compressionEnabled !== undefined) {
			updates.push('compression_enabled = ?');
			params.push(input.compressionEnabled ? 1 : 0);
		}

		if (updates.length === 0) {
			return false;
		}

		// Add updated_at
		updates.push('updated_at = CURRENT_TIMESTAMP');
		params.push(1); // id is always 1

		const affected = db.execute(
			`UPDATE backup_settings SET ${updates.join(', ')} WHERE id = ?`,
			...params
		);

		return affected > 0;
	},

	/**
	 * Reset backup settings to defaults
	 */
	reset(): boolean {
		const affected = db.execute(`
			UPDATE backup_settings SET
				schedule = 'daily',
				retention_days = 30,
				enabled = 1,
				include_database = 1,
				compression_enabled = 1,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = 1
		`);

		return affected > 0;
	}
};
