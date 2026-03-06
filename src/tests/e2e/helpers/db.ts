/**
 * Direct SQLite access to profilarr.db for verifying state in tests.
 * Uses better-sqlite3 (synchronous) so assertions are straightforward.
 */
import Database from 'better-sqlite3';
import { DB_PATH } from '../env';

export interface PcdOp {
	id: number;
	database_id: number;
	origin: string;
	state: string;
	operation: string | null;
	metadata: string | null;
	desired_state: string | null;
	filepath: string | null;
	created_at: string;
	updated_at: string;
}

export interface PcdOpHistory {
	id: number;
	op_id: number;
	database_id: number;
	batch_id: string | null;
	status: string;
	conflict_reason: string | null;
	rowcount: number | null;
	error: string | null;
	details: string | null;
	applied_at: string;
}

export interface DatabaseInstance {
	id: number;
	uuid: string;
	name: string;
	repository_url: string;
	conflict_strategy: string | null;
	enabled: number;
}

/** Open a read-only connection to the app database */
export function openDb(): Database.Database {
	return new Database(DB_PATH, { readonly: true });
}

/** Find a database instance by name */
export function getDatabaseByName(name: string): DatabaseInstance | undefined {
	const db = openDb();
	try {
		return db.prepare('SELECT * FROM database_instances WHERE name = ?').get(name) as
			| DatabaseInstance
			| undefined;
	} finally {
		db.close();
	}
}

/** Get a pcd_ops row by ID */
export function getOp(opId: number): PcdOp | undefined {
	const db = openDb();
	try {
		return db.prepare('SELECT * FROM pcd_ops WHERE id = ?').get(opId) as PcdOp | undefined;
	} finally {
		db.close();
	}
}

/** Get all ops for a database, optionally filtered by origin and/or state */
export function getOps(databaseId: number, filters?: { origin?: string; state?: string }): PcdOp[] {
	const db = openDb();
	try {
		let sql = 'SELECT * FROM pcd_ops WHERE database_id = ?';
		const params: unknown[] = [databaseId];

		if (filters?.origin) {
			sql += ' AND origin = ?';
			params.push(filters.origin);
		}
		if (filters?.state) {
			sql += ' AND state = ?';
			params.push(filters.state);
		}

		sql += ' ORDER BY id DESC';
		return db.prepare(sql).all(...params) as PcdOp[];
	} finally {
		db.close();
	}
}

/** Get the latest history entry for an op */
export function getLatestHistory(opId: number): PcdOpHistory | undefined {
	const db = openDb();
	try {
		return db
			.prepare('SELECT * FROM pcd_op_history WHERE op_id = ? ORDER BY id DESC LIMIT 1')
			.get(opId) as PcdOpHistory | undefined;
	} finally {
		db.close();
	}
}

/** Get all history entries for an op */
export function getOpHistory(opId: number): PcdOpHistory[] {
	const db = openDb();
	try {
		return db
			.prepare('SELECT * FROM pcd_op_history WHERE op_id = ? ORDER BY id DESC')
			.all(opId) as PcdOpHistory[];
	} finally {
		db.close();
	}
}

/** Get all conflicted/conflicted_pending history for a database */
export function getConflicts(databaseId: number): PcdOpHistory[] {
	const db = openDb();
	try {
		return db
			.prepare(
				`SELECT h.* FROM pcd_op_history h
         INNER JOIN pcd_ops o ON o.id = h.op_id
         WHERE o.database_id = ?
           AND h.status IN ('conflicted', 'conflicted_pending')
         ORDER BY h.id DESC`
			)
			.all(databaseId) as PcdOpHistory[];
	} finally {
		db.close();
	}
}

/** Find an op by entity name in its metadata JSON */
export function findOpByEntityName(
	databaseId: number,
	entityName: string,
	filters?: { origin?: string; state?: string }
): PcdOp | undefined {
	const db = openDb();
	try {
		let sql = `SELECT * FROM pcd_ops
               WHERE database_id = ?
                 AND json_extract(metadata, '$.name') = ?`;
		const params: unknown[] = [databaseId, entityName];

		if (filters?.origin) {
			sql += ' AND origin = ?';
			params.push(filters.origin);
		}
		if (filters?.state) {
			sql += ' AND state = ?';
			params.push(filters.state);
		}

		sql += ' ORDER BY id DESC LIMIT 1';
		return db.prepare(sql).get(...params) as PcdOp | undefined;
	} finally {
		db.close();
	}
}

/** Parse the metadata JSON from an op */
export function parseMetadata(op: PcdOp): Record<string, unknown> | null {
	if (!op.metadata) return null;
	try {
		return JSON.parse(op.metadata);
	} catch {
		return null;
	}
}

/** Parse the desired_state JSON from an op */
export function parseDesiredState(op: PcdOp): Record<string, unknown> | null {
	if (!op.desired_state) return null;
	try {
		return JSON.parse(op.desired_state);
	} catch {
		return null;
	}
}
