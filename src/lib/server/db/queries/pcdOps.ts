import { db } from '../db.ts';

export type PcdOpOrigin = 'base' | 'user';
export type PcdOpState = 'published' | 'draft' | 'superseded' | 'dropped' | 'orphaned';
export type PcdOpSource = 'repo' | 'local' | 'import';

export interface PcdOp {
	id: number;
	database_id: number;
	origin: PcdOpOrigin;
	state: PcdOpState;
	source: PcdOpSource;
	filename: string | null;
	op_number: number | null;
	sequence: number | null;
	sql: string;
	metadata: string | null;
	desired_state: string | null;
	content_hash: string | null;
	last_seen_in_repo_at: string | null;
	superseded_by_op_id: number | null;
	pushed_at: string | null;
	pushed_commit: string | null;
	created_at: string;
	updated_at: string;
}

export interface CreatePcdOpInput {
	databaseId: number;
	origin: PcdOpOrigin;
	state: PcdOpState;
	source: PcdOpSource;
	sql: string;
	filename?: string | null;
	opNumber?: number | null;
	sequence?: number | null;
	metadata?: string | null;
	desiredState?: string | null;
	contentHash?: string | null;
	lastSeenInRepoAt?: string | null;
	supersededByOpId?: number | null;
	pushedAt?: string | null;
	pushedCommit?: string | null;
}

export interface UpdatePcdOpInput {
	state?: PcdOpState;
	source?: PcdOpSource;
	filename?: string | null;
	opNumber?: number | null;
	sequence?: number | null;
	sql?: string;
	metadata?: string | null;
	desiredState?: string | null;
	contentHash?: string | null;
	lastSeenInRepoAt?: string | null;
	supersededByOpId?: number | null;
	pushedAt?: string | null;
	pushedCommit?: string | null;
}

export interface ListPcdOpsOptions {
	states?: PcdOpState[];
	source?: PcdOpSource;
}

export const pcdOpsQueries = {
	create(input: CreatePcdOpInput): number {
		db.execute(
			`INSERT INTO pcd_ops (
				database_id, origin, state, source,
				filename, op_number, sequence,
				sql, metadata, desired_state,
				content_hash, last_seen_in_repo_at,
				superseded_by_op_id, pushed_at, pushed_commit
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			input.databaseId,
			input.origin,
			input.state,
			input.source,
			input.filename ?? null,
			input.opNumber ?? null,
			input.sequence ?? null,
			input.sql,
			input.metadata ?? null,
			input.desiredState ?? null,
			input.contentHash ?? null,
			input.lastSeenInRepoAt ?? null,
			input.supersededByOpId ?? null,
			input.pushedAt ?? null,
			input.pushedCommit ?? null
		);

		const result = db.queryFirst<{ id: number }>('SELECT last_insert_rowid() as id');
		return result?.id ?? 0;
	},

	getById(id: number): PcdOp | undefined {
		return db.queryFirst<PcdOp>('SELECT * FROM pcd_ops WHERE id = ?', id);
	},

	listByDatabase(databaseId: number, origin?: PcdOpOrigin): PcdOp[] {
		if (origin) {
			return db.query<PcdOp>(
				'SELECT * FROM pcd_ops WHERE database_id = ? AND origin = ? ORDER BY id',
				databaseId,
				origin
			);
		}
		return db.query<PcdOp>('SELECT * FROM pcd_ops WHERE database_id = ? ORDER BY id', databaseId);
	},

	listByDatabaseAndOrigin(
		databaseId: number,
		origin: PcdOpOrigin,
		options?: ListPcdOpsOptions
	): PcdOp[] {
		const clauses = ['database_id = ?', 'origin = ?'];
		const params: Array<string | number> = [databaseId, origin];

		if (options?.source) {
			clauses.push('source = ?');
			params.push(options.source);
		}

		if (options?.states && options.states.length > 0) {
			const placeholders = options.states.map(() => '?').join(', ');
			clauses.push(`state IN (${placeholders})`);
			params.push(...options.states);
		}

		const where = clauses.join(' AND ');
		return db.query<PcdOp>(`SELECT * FROM pcd_ops WHERE ${where} ORDER BY id`, ...params);
	},

	getBaseByFilename(databaseId: number, filename: string): PcdOp | undefined {
		return db.queryFirst<PcdOp>(
			"SELECT * FROM pcd_ops WHERE database_id = ? AND origin = 'base' AND filename = ?",
			databaseId,
			filename
		);
	},

	update(id: number, input: UpdatePcdOpInput): boolean {
		const updates: string[] = [];
		const params: Array<string | number | null> = [];

		if (input.state !== undefined) {
			updates.push('state = ?');
			params.push(input.state);
		}
		if (input.source !== undefined) {
			updates.push('source = ?');
			params.push(input.source);
		}
		if (input.filename !== undefined) {
			updates.push('filename = ?');
			params.push(input.filename ?? null);
		}
		if (input.opNumber !== undefined) {
			updates.push('op_number = ?');
			params.push(input.opNumber ?? null);
		}
		if (input.sequence !== undefined) {
			updates.push('sequence = ?');
			params.push(input.sequence ?? null);
		}
		if (input.sql !== undefined) {
			updates.push('sql = ?');
			params.push(input.sql);
		}
		if (input.metadata !== undefined) {
			updates.push('metadata = ?');
			params.push(input.metadata ?? null);
		}
		if (input.desiredState !== undefined) {
			updates.push('desired_state = ?');
			params.push(input.desiredState ?? null);
		}
		if (input.contentHash !== undefined) {
			updates.push('content_hash = ?');
			params.push(input.contentHash ?? null);
		}
		if (input.lastSeenInRepoAt !== undefined) {
			updates.push('last_seen_in_repo_at = ?');
			params.push(input.lastSeenInRepoAt ?? null);
		}
		if (input.supersededByOpId !== undefined) {
			updates.push('superseded_by_op_id = ?');
			params.push(input.supersededByOpId ?? null);
		}
		if (input.pushedAt !== undefined) {
			updates.push('pushed_at = ?');
			params.push(input.pushedAt ?? null);
		}
		if (input.pushedCommit !== undefined) {
			updates.push('pushed_commit = ?');
			params.push(input.pushedCommit ?? null);
		}

		if (updates.length === 0) return false;

		updates.push('updated_at = CURRENT_TIMESTAMP');
		params.push(id);

		const affected = db.execute(`UPDATE pcd_ops SET ${updates.join(', ')} WHERE id = ?`, ...params);
		return affected > 0;
	},

	markBaseOrphaned(databaseId: number, seenAt: string): number {
		return db.execute(
			`UPDATE pcd_ops
       SET state = 'orphaned', updated_at = CURRENT_TIMESTAMP
       WHERE database_id = ?
         AND origin = 'base'
         AND source = 'repo'
         AND (last_seen_in_repo_at IS NULL OR last_seen_in_repo_at < ?)`,
			databaseId,
			seenAt
		);
	}
};
