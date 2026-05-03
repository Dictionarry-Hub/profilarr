import { db } from '../db.ts';
import { toUTC } from '$shared/utils/dates.ts';
import type { DriftCounts, DriftDiff, DriftRunStatus } from '$shared/drift.ts';

interface DriftStatusRow {
	id: number;
	arr_instance_id: number;
	status: DriftRunStatus;
	last_checked_at: string | null;
	counts_json: string;
	diff_json: string;
	diff_hash: string | null;
	last_notified_hash: string | null;
	last_notified_at: string | null;
	last_error: string | null;
	error_hash: string | null;
	last_notified_error_hash: string | null;
	created_at: string;
	updated_at: string;
}

export interface DriftStatusRecord {
	id: number;
	arrInstanceId: number;
	status: DriftRunStatus;
	lastCheckedAt: string | null;
	counts: DriftCounts;
	diff: DriftDiff;
	diffHash: string | null;
	lastNotifiedHash: string | null;
	lastNotifiedAt: string | null;
	lastError: string | null;
	errorHash: string | null;
	lastNotifiedErrorHash: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface DriftStatusInput {
	status?: DriftRunStatus;
	lastCheckedAt?: string | null;
	counts?: DriftCounts;
	diff?: DriftDiff;
	diffHash?: string | null;
	lastNotifiedHash?: string | null;
	lastNotifiedAt?: string | null;
	lastError?: string | null;
	errorHash?: string | null;
	lastNotifiedErrorHash?: string | null;
}

function parseJson<T>(raw: string, fallback: T): T {
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object' ? (parsed as T) : fallback;
	} catch {
		return fallback;
	}
}

function rowToStatus(row: DriftStatusRow): DriftStatusRecord {
	return {
		id: row.id,
		arrInstanceId: row.arr_instance_id,
		status: row.status,
		lastCheckedAt: toUTC(row.last_checked_at),
		counts: parseJson<DriftCounts>(row.counts_json, {}),
		diff: parseJson<DriftDiff>(row.diff_json, {}),
		diffHash: row.diff_hash,
		lastNotifiedHash: row.last_notified_hash,
		lastNotifiedAt: toUTC(row.last_notified_at),
		lastError: row.last_error,
		errorHash: row.error_hash,
		lastNotifiedErrorHash: row.last_notified_error_hash,
		createdAt: toUTC(row.created_at)!,
		updatedAt: toUTC(row.updated_at)!
	};
}

export const arrDriftStatusQueries = {
	getByInstanceId(arrInstanceId: number): DriftStatusRecord | undefined {
		const row = db.queryFirst<DriftStatusRow>(
			'SELECT * FROM arr_drift_status WHERE arr_instance_id = ?',
			arrInstanceId
		);
		return row ? rowToStatus(row) : undefined;
	},

	getAll(): DriftStatusRecord[] {
		const rows = db.query<DriftStatusRow>('SELECT * FROM arr_drift_status');
		return rows.map(rowToStatus);
	},

	ensure(arrInstanceId: number): DriftStatusRecord {
		const existing = this.getByInstanceId(arrInstanceId);
		if (existing) return existing;

		db.execute('INSERT INTO arr_drift_status (arr_instance_id) VALUES (?)', arrInstanceId);
		return this.getByInstanceId(arrInstanceId)!;
	},

	upsert(arrInstanceId: number, input: DriftStatusInput): DriftStatusRecord {
		this.ensure(arrInstanceId);
		this.update(arrInstanceId, input);
		return this.getByInstanceId(arrInstanceId)!;
	},

	update(arrInstanceId: number, input: DriftStatusInput): boolean {
		const updates: string[] = [];
		const params: Array<string | number | null> = [];

		if (input.status !== undefined) {
			updates.push('status = ?');
			params.push(input.status);
		}
		if (input.lastCheckedAt !== undefined) {
			updates.push('last_checked_at = ?');
			params.push(input.lastCheckedAt);
		}
		if (input.counts !== undefined) {
			updates.push('counts_json = ?');
			params.push(JSON.stringify(input.counts));
		}
		if (input.diff !== undefined) {
			updates.push('diff_json = ?');
			params.push(JSON.stringify(input.diff));
		}
		if (input.diffHash !== undefined) {
			updates.push('diff_hash = ?');
			params.push(input.diffHash);
		}
		if (input.lastNotifiedHash !== undefined) {
			updates.push('last_notified_hash = ?');
			params.push(input.lastNotifiedHash);
		}
		if (input.lastNotifiedAt !== undefined) {
			updates.push('last_notified_at = ?');
			params.push(input.lastNotifiedAt);
		}
		if (input.lastError !== undefined) {
			updates.push('last_error = ?');
			params.push(input.lastError);
		}
		if (input.errorHash !== undefined) {
			updates.push('error_hash = ?');
			params.push(input.errorHash);
		}
		if (input.lastNotifiedErrorHash !== undefined) {
			updates.push('last_notified_error_hash = ?');
			params.push(input.lastNotifiedErrorHash);
		}

		if (updates.length === 0) {
			return false;
		}

		updates.push('updated_at = CURRENT_TIMESTAMP');
		params.push(arrInstanceId);

		const affected = db.execute(
			`UPDATE arr_drift_status SET ${updates.join(', ')} WHERE arr_instance_id = ?`,
			...params
		);

		return affected > 0;
	},

	delete(arrInstanceId: number): boolean {
		const affected = db.execute(
			'DELETE FROM arr_drift_status WHERE arr_instance_id = ?',
			arrInstanceId
		);
		return affected > 0;
	}
};
