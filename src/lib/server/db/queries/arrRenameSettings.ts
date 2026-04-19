import { db } from '../db.ts';
import { toUTC } from '$shared/utils/dates.ts';

/**
 * Database row type for arr_rename_settings table
 */
interface RenameSettingsRow {
	id: number;
	arr_instance_id: number;
	rename_folders: number;
	ignore_tag: string | null;
	summary_notifications: number;
	enabled: number;
	cron: string;
	next_run_at: string | null;
	last_run_at: string | null;
	created_at: string;
	updated_at: string;
}

/**
 * Rename settings as returned to application code
 */
export interface RenameSettings {
	id: number;
	arrInstanceId: number;
	renameFolders: boolean;
	ignoreTag: string | null;
	summaryNotifications: boolean;
	enabled: boolean;
	cron: string;
	nextRunAt: string | null;
	lastRunAt: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * Input for creating/updating rename settings
 */
export interface RenameSettingsInput {
	renameFolders?: boolean;
	ignoreTag?: string | null;
	summaryNotifications?: boolean;
	enabled?: boolean;
	cron?: string;
}

/**
 * Convert database row to RenameSettings
 */
function rowToSettings(row: RenameSettingsRow): RenameSettings {
	return {
		id: row.id,
		arrInstanceId: row.arr_instance_id,
		renameFolders: row.rename_folders === 1,
		ignoreTag: row.ignore_tag,
		summaryNotifications: row.summary_notifications === 1,
		enabled: row.enabled === 1,
		cron: row.cron,
		nextRunAt: toUTC(row.next_run_at),
		lastRunAt: toUTC(row.last_run_at),
		createdAt: toUTC(row.created_at)!,
		updatedAt: toUTC(row.updated_at)!
	};
}

/**
 * All queries for arr_rename_settings table
 */
export const arrRenameSettingsQueries = {
	/**
	 * Get rename settings by arr instance ID
	 */
	getByInstanceId(arrInstanceId: number): RenameSettings | undefined {
		const row = db.queryFirst<RenameSettingsRow>(
			'SELECT * FROM arr_rename_settings WHERE arr_instance_id = ?',
			arrInstanceId
		);
		return row ? rowToSettings(row) : undefined;
	},

	/**
	 * Get all rename settings
	 */
	getAll(): RenameSettings[] {
		const rows = db.query<RenameSettingsRow>('SELECT * FROM arr_rename_settings');
		return rows.map(rowToSettings);
	},

	/**
	 * Get all enabled rename settings
	 */
	getEnabled(): RenameSettings[] {
		const rows = db.query<RenameSettingsRow>('SELECT * FROM arr_rename_settings WHERE enabled = 1');
		return rows.map(rowToSettings);
	},

	/**
	 * Create or update rename settings for an arr instance
	 * Uses upsert pattern since there's one config per instance
	 */
	upsert(arrInstanceId: number, input: RenameSettingsInput): RenameSettings {
		const existing = this.getByInstanceId(arrInstanceId);

		if (existing) {
			this.update(arrInstanceId, input);
			return this.getByInstanceId(arrInstanceId)!;
		}

		// Create new with defaults
		const renameFolders = input.renameFolders !== undefined ? (input.renameFolders ? 1 : 0) : 0;
		const ignoreTag = input.ignoreTag ?? null;
		const summaryNotifications =
			input.summaryNotifications !== undefined ? (input.summaryNotifications ? 1 : 0) : 1;
		const enabled = input.enabled !== undefined ? (input.enabled ? 1 : 0) : 0;
		const cron = input.cron ?? '0 0 * * *';

		db.execute(
			`INSERT INTO arr_rename_settings
			(arr_instance_id, rename_folders, ignore_tag, summary_notifications, enabled, cron)
			VALUES (?, ?, ?, ?, ?, ?)`,
			arrInstanceId,
			renameFolders,
			ignoreTag,
			summaryNotifications,
			enabled,
			cron
		);

		return this.getByInstanceId(arrInstanceId)!;
	},

	/**
	 * Update rename settings
	 */
	update(arrInstanceId: number, input: RenameSettingsInput): boolean {
		const updates: string[] = [];
		const params: (string | number | null)[] = [];

		if (input.renameFolders !== undefined) {
			updates.push('rename_folders = ?');
			params.push(input.renameFolders ? 1 : 0);
		}
		if (input.ignoreTag !== undefined) {
			updates.push('ignore_tag = ?');
			params.push(input.ignoreTag);
		}
		if (input.summaryNotifications !== undefined) {
			updates.push('summary_notifications = ?');
			params.push(input.summaryNotifications ? 1 : 0);
		}
		if (input.enabled !== undefined) {
			updates.push('enabled = ?');
			params.push(input.enabled ? 1 : 0);
		}
		if (input.cron !== undefined) {
			updates.push('cron = ?');
			params.push(input.cron);
		}

		if (updates.length === 0) {
			return false;
		}

		updates.push('updated_at = CURRENT_TIMESTAMP');
		params.push(arrInstanceId);

		const affected = db.execute(
			`UPDATE arr_rename_settings SET ${updates.join(', ')} WHERE arr_instance_id = ?`,
			...params
		);

		return affected > 0;
	},

	/**
	 * Delete rename settings
	 */
	delete(arrInstanceId: number): boolean {
		const affected = db.execute(
			'DELETE FROM arr_rename_settings WHERE arr_instance_id = ?',
			arrInstanceId
		);
		return affected > 0;
	},

	/**
	 * Update last_run_at to current timestamp
	 */
	updateLastRun(arrInstanceId: number): void {
		db.execute(
			'UPDATE arr_rename_settings SET last_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE arr_instance_id = ?',
			arrInstanceId
		);
	},

	/**
	 * Update next_run_at
	 */
	updateNextRunAt(arrInstanceId: number, nextRunAt: string | null): void {
		db.execute(
			'UPDATE arr_rename_settings SET next_run_at = ?, updated_at = CURRENT_TIMESTAMP WHERE arr_instance_id = ?',
			nextRunAt,
			arrInstanceId
		);
	},

	/**
	 * Get all enabled configs that are due to run
	 * A config is due if: next_run_at is null OR now >= next_run_at
	 */
	getDueConfigs(): RenameSettings[] {
		const rows = db.query<RenameSettingsRow>(`
			SELECT * FROM arr_rename_settings
			WHERE enabled = 1
			AND (
				next_run_at IS NULL
				OR datetime('now') >= datetime(replace(replace(next_run_at, 'T', ' '), 'Z', ''))
			)
		`);
		return rows.map(rowToSettings);
	}
};
