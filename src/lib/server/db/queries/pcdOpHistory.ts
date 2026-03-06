import { db } from '../db.ts';
import type { PcdOp } from './pcdOps.ts';

export type PcdOpHistoryStatus =
	| 'applied'
	| 'skipped'
	| 'conflicted'
	| 'conflicted_pending'
	| 'error'
	| 'dropped'
	| 'superseded';

export interface PcdOpHistory {
	id: number;
	op_id: number;
	database_id: number;
	batch_id: string;
	status: PcdOpHistoryStatus;
	rowcount: number | null;
	conflict_reason: string | null;
	error: string | null;
	details: string | null;
	applied_at: string;
}

export interface CreatePcdOpHistoryInput {
	opId: number;
	databaseId: number;
	batchId: string;
	status: PcdOpHistoryStatus;
	rowcount?: number | null;
	conflictReason?: string | null;
	error?: string | null;
	details?: string | null;
}

export interface PcdOpHistoryWithOp {
	history: PcdOpHistory;
	op: PcdOp;
}

type LatestOpHistoryRow = {
	history_id: number;
	history_op_id: number;
	history_database_id: number;
	history_batch_id: string;
	history_status: PcdOpHistoryStatus;
	history_rowcount: number | null;
	history_conflict_reason: string | null;
	history_error: string | null;
	history_details: string | null;
	history_applied_at: string;
	op_row_id: number;
	op_database_id: number;
	op_origin: PcdOp['origin'];
	op_state: PcdOp['state'];
	op_source: PcdOp['source'];
	op_filename: string | null;
	op_op_number: number | null;
	op_sequence: number | null;
	op_sql: string;
	op_metadata: string | null;
	op_desired_state: string | null;
	op_content_hash: string | null;
	op_last_seen_in_repo_at: string | null;
	op_superseded_by_op_id: number | null;
	op_pushed_at: string | null;
	op_pushed_commit: string | null;
	op_created_at: string;
	op_updated_at: string;
};

function mapLatestRow(row: LatestOpHistoryRow): PcdOpHistoryWithOp {
	return {
		history: {
			id: row.history_id,
			op_id: row.history_op_id,
			database_id: row.history_database_id,
			batch_id: row.history_batch_id,
			status: row.history_status,
			rowcount: row.history_rowcount,
			conflict_reason: row.history_conflict_reason,
			error: row.history_error,
			details: row.history_details,
			applied_at: row.history_applied_at
		},
		op: {
			id: row.op_row_id,
			database_id: row.op_database_id,
			origin: row.op_origin,
			state: row.op_state,
			source: row.op_source,
			filename: row.op_filename,
			op_number: row.op_op_number,
			sequence: row.op_sequence,
			sql: row.op_sql,
			metadata: row.op_metadata,
			desired_state: row.op_desired_state,
			content_hash: row.op_content_hash,
			last_seen_in_repo_at: row.op_last_seen_in_repo_at,
			superseded_by_op_id: row.op_superseded_by_op_id,
			pushed_at: row.op_pushed_at,
			pushed_commit: row.op_pushed_commit,
			created_at: row.op_created_at,
			updated_at: row.op_updated_at
		}
	};
}

export const pcdOpHistoryQueries = {
	create(input: CreatePcdOpHistoryInput): number {
		db.execute(
			`INSERT INTO pcd_op_history (
				op_id, database_id, batch_id, status,
				rowcount, conflict_reason, error, details
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			input.opId,
			input.databaseId,
			input.batchId,
			input.status,
			input.rowcount ?? null,
			input.conflictReason ?? null,
			input.error ?? null,
			input.details ?? null
		);

		const result = db.queryFirst<{ id: number }>('SELECT last_insert_rowid() as id');
		return result?.id ?? 0;
	},

	listByOp(opId: number): PcdOpHistory[] {
		return db.query<PcdOpHistory>(
			'SELECT * FROM pcd_op_history WHERE op_id = ? ORDER BY applied_at DESC, id DESC',
			opId
		);
	},

	listByDatabase(databaseId: number): PcdOpHistory[] {
		return db.query<PcdOpHistory>(
			'SELECT * FROM pcd_op_history WHERE database_id = ? ORDER BY applied_at DESC, id DESC',
			databaseId
		);
	},

	listLatestByDatabaseWithOps(
		databaseId: number,
		statuses?: PcdOpHistoryStatus[]
	): PcdOpHistoryWithOp[] {
		const params: Array<string | number> = [databaseId];
		let statusClause = '';

		if (statuses && statuses.length > 0) {
			const placeholders = statuses.map(() => '?').join(', ');
			statusClause = `AND latest.status IN (${placeholders})`;
			params.push(...statuses);
		}

		const rows = db.query<LatestOpHistoryRow>(
			`SELECT
				latest.id as history_id,
				latest.op_id as history_op_id,
				latest.database_id as history_database_id,
				latest.batch_id as history_batch_id,
				latest.status as history_status,
				latest.rowcount as history_rowcount,
				latest.conflict_reason as history_conflict_reason,
				latest.error as history_error,
				latest.details as history_details,
				latest.applied_at as history_applied_at,
				op.id as op_row_id,
				op.database_id as op_database_id,
				op.origin as op_origin,
				op.state as op_state,
				op.source as op_source,
				op.filename as op_filename,
				op.op_number as op_op_number,
				op.sequence as op_sequence,
				op.sql as op_sql,
				op.metadata as op_metadata,
				op.desired_state as op_desired_state,
				op.content_hash as op_content_hash,
				op.last_seen_in_repo_at as op_last_seen_in_repo_at,
				op.superseded_by_op_id as op_superseded_by_op_id,
				op.pushed_at as op_pushed_at,
				op.pushed_commit as op_pushed_commit,
				op.created_at as op_created_at,
				op.updated_at as op_updated_at
			FROM (
				SELECT *,
					ROW_NUMBER() OVER (PARTITION BY op_id ORDER BY applied_at DESC, id DESC) as rn
				FROM pcd_op_history
				WHERE database_id = ?
			) as latest
			JOIN pcd_ops op ON op.id = latest.op_id
			WHERE latest.rn = 1
			${statusClause}
			ORDER BY latest.applied_at DESC, latest.id DESC`,
			...params
		);

		return rows.map(mapLatestRow);
	},

	listLatestConflictsByDatabase(databaseId: number): PcdOpHistoryWithOp[] {
		return this.listLatestByDatabaseWithOps(databaseId, ['conflicted', 'conflicted_pending']);
	}
};
