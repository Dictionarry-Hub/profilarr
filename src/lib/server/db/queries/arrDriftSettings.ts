import { db } from '../db.ts';
import { toUTC } from '$shared/utils/dates.ts';

interface DriftSettingsRow {
	id: number;
	arr_instance_id: number;
	enabled: number;
	cron: string;
	next_run_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface DriftSettings {
	id: number;
	arrInstanceId: number;
	enabled: boolean;
	cron: string;
	nextRunAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface DriftSettingsInput {
	enabled?: boolean;
	cron?: string;
	nextRunAt?: string | null;
}

function rowToSettings(row: DriftSettingsRow): DriftSettings {
	return {
		id: row.id,
		arrInstanceId: row.arr_instance_id,
		enabled: row.enabled === 1,
		cron: row.cron,
		nextRunAt: toUTC(row.next_run_at),
		createdAt: toUTC(row.created_at)!,
		updatedAt: toUTC(row.updated_at)!
	};
}

export const arrDriftSettingsQueries = {
	getByInstanceId(arrInstanceId: number): DriftSettings | undefined {
		const row = db.queryFirst<DriftSettingsRow>(
			'SELECT * FROM arr_drift_settings WHERE arr_instance_id = ?',
			arrInstanceId
		);
		return row ? rowToSettings(row) : undefined;
	},

	getAll(): DriftSettings[] {
		const rows = db.query<DriftSettingsRow>('SELECT * FROM arr_drift_settings');
		return rows.map(rowToSettings);
	},

	getEnabled(): DriftSettings[] {
		const rows = db.query<DriftSettingsRow>('SELECT * FROM arr_drift_settings WHERE enabled = 1');
		return rows.map(rowToSettings);
	},

	upsert(arrInstanceId: number, input: DriftSettingsInput): DriftSettings {
		const existing = this.getByInstanceId(arrInstanceId);
		if (existing) {
			this.update(arrInstanceId, input);
			return this.getByInstanceId(arrInstanceId)!;
		}

		const enabled = input.enabled !== undefined ? (input.enabled ? 1 : 0) : 0;
		const cron = input.cron ?? '0 0 * * *';
		const nextRunAt = input.nextRunAt ?? null;

		db.execute(
			`INSERT INTO arr_drift_settings (arr_instance_id, enabled, cron, next_run_at)
			 VALUES (?, ?, ?, ?)`,
			arrInstanceId,
			enabled,
			cron,
			nextRunAt
		);

		return this.getByInstanceId(arrInstanceId)!;
	},

	update(arrInstanceId: number, input: DriftSettingsInput): boolean {
		const updates: string[] = [];
		const params: Array<string | number | null> = [];

		if (input.enabled !== undefined) {
			updates.push('enabled = ?');
			params.push(input.enabled ? 1 : 0);
		}
		if (input.cron !== undefined) {
			updates.push('cron = ?');
			params.push(input.cron);
		}
		if (input.nextRunAt !== undefined) {
			updates.push('next_run_at = ?');
			params.push(input.nextRunAt);
		}

		if (updates.length === 0) {
			return false;
		}

		updates.push('updated_at = CURRENT_TIMESTAMP');
		params.push(arrInstanceId);

		const affected = db.execute(
			`UPDATE arr_drift_settings SET ${updates.join(', ')} WHERE arr_instance_id = ?`,
			...params
		);

		return affected > 0;
	},

	delete(arrInstanceId: number): boolean {
		const affected = db.execute(
			'DELETE FROM arr_drift_settings WHERE arr_instance_id = ?',
			arrInstanceId
		);
		return affected > 0;
	},

	updateNextRunAt(arrInstanceId: number, nextRunAt: string | null): void {
		db.execute(
			'UPDATE arr_drift_settings SET next_run_at = ?, updated_at = CURRENT_TIMESTAMP WHERE arr_instance_id = ?',
			nextRunAt,
			arrInstanceId
		);
	},

	getDueConfigs(): DriftSettings[] {
		const rows = db.query<DriftSettingsRow>(`
			SELECT * FROM arr_drift_settings
			WHERE enabled = 1
			AND (
				next_run_at IS NULL
				OR datetime('now') >= datetime(replace(replace(next_run_at, 'T', ' '), 'Z', ''))
			)
		`);
		return rows.map(rowToSettings);
	}
};
