import { db } from '../db.ts';
import { toUTC } from '$shared/utils/dates.ts';

interface CleanupSettingsRow {
	id: number;
	arr_instance_id: number;
	enabled: number;
	cron: string;
	next_run_at: string | null;
	last_run_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface CleanupSettings {
	id: number;
	arrInstanceId: number;
	enabled: boolean;
	cron: string;
	nextRunAt: string | null;
	lastRunAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CleanupSettingsInput {
	enabled?: boolean;
	cron?: string;
}

function rowToSettings(row: CleanupSettingsRow): CleanupSettings {
	return {
		id: row.id,
		arrInstanceId: row.arr_instance_id,
		enabled: row.enabled === 1,
		cron: row.cron,
		nextRunAt: toUTC(row.next_run_at),
		lastRunAt: toUTC(row.last_run_at),
		createdAt: toUTC(row.created_at)!,
		updatedAt: toUTC(row.updated_at)!
	};
}

export const arrCleanupSettingsQueries = {
	getByInstanceId(arrInstanceId: number): CleanupSettings | undefined {
		const row = db.queryFirst<CleanupSettingsRow>(
			'SELECT * FROM arr_cleanup_settings WHERE arr_instance_id = ?',
			arrInstanceId
		);
		return row ? rowToSettings(row) : undefined;
	},

	getAll(): CleanupSettings[] {
		const rows = db.query<CleanupSettingsRow>('SELECT * FROM arr_cleanup_settings');
		return rows.map(rowToSettings);
	},

	getEnabled(): CleanupSettings[] {
		const rows = db.query<CleanupSettingsRow>(
			'SELECT * FROM arr_cleanup_settings WHERE enabled = 1'
		);
		return rows.map(rowToSettings);
	},

	upsert(arrInstanceId: number, input: CleanupSettingsInput): CleanupSettings {
		const existing = this.getByInstanceId(arrInstanceId);

		if (existing) {
			this.update(arrInstanceId, input);
			return this.getByInstanceId(arrInstanceId)!;
		}

		const enabled = input.enabled !== undefined ? (input.enabled ? 1 : 0) : 0;
		const cron = input.cron ?? '0 0 * * 0';

		db.execute(
			`INSERT INTO arr_cleanup_settings (arr_instance_id, enabled, cron) VALUES (?, ?, ?)`,
			arrInstanceId,
			enabled,
			cron
		);

		return this.getByInstanceId(arrInstanceId)!;
	},

	update(arrInstanceId: number, input: CleanupSettingsInput): boolean {
		const updates: string[] = [];
		const params: (string | number | null)[] = [];

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
			`UPDATE arr_cleanup_settings SET ${updates.join(', ')} WHERE arr_instance_id = ?`,
			...params
		);

		return affected > 0;
	},

	delete(arrInstanceId: number): boolean {
		const affected = db.execute(
			'DELETE FROM arr_cleanup_settings WHERE arr_instance_id = ?',
			arrInstanceId
		);
		return affected > 0;
	},

	updateLastRun(arrInstanceId: number): void {
		db.execute(
			'UPDATE arr_cleanup_settings SET last_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE arr_instance_id = ?',
			arrInstanceId
		);
	},

	updateNextRunAt(arrInstanceId: number, nextRunAt: string | null): void {
		db.execute(
			'UPDATE arr_cleanup_settings SET next_run_at = ?, updated_at = CURRENT_TIMESTAMP WHERE arr_instance_id = ?',
			nextRunAt,
			arrInstanceId
		);
	},

	getDueConfigs(): CleanupSettings[] {
		const rows = db.query<CleanupSettingsRow>(`
			SELECT * FROM arr_cleanup_settings
			WHERE enabled = 1
			AND (
				next_run_at IS NULL
				OR datetime('now') >= datetime(replace(replace(next_run_at, 'T', ' '), 'Z', ''))
			)
		`);
		return rows.map(rowToSettings);
	}
};
