/**
 * PCD conflict test helpers — create database instances, insert ops, query state.
 */

import { Database } from 'jsr:@db/sqlite@0.12';
import { log } from '$test-harness/log.ts';

// ─── Database Instance ─────────────────────────────────────────────────────────

export interface CreateDatabaseInstanceOpts {
	name?: string;
	uuid: string;
	localPath: string;
	conflictStrategy?: 'override' | 'align' | 'ask';
	enabled?: boolean;
}

/**
 * Insert a database_instances row directly. Also marks default_database_linked
 * so the auto-link hook won't fire on future startups.
 */
export function createDatabaseInstance(dbPath: string, opts: CreateDatabaseInstanceOpts): number {
	log.setup(`Creating database instance "${opts.name ?? 'test-db'}"`);
	const db = new Database(dbPath);
	try {
		db.exec(
			`INSERT INTO database_instances (
				uuid, name, repository_url, local_path,
				sync_strategy, auto_pull, enabled, is_private,
				local_ops_enabled, conflict_strategy
			) VALUES (?, ?, '', ?, 60, 0, ?, 0, 1, ?)`,
			[
				opts.uuid,
				opts.name ?? 'test-db',
				opts.localPath,
				opts.enabled !== false ? 1 : 0,
				opts.conflictStrategy ?? 'ask'
			]
		);
		const row = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
		const id = row.id;

		// Prevent auto-link from firing
		db.exec('UPDATE setup_state SET default_database_linked = 1 WHERE id = 1');

		log.setup(`Database instance created with id=${id}`);
		return id;
	} finally {
		db.close();
	}
}

// ─── PCD Ops ────────────────────────────────────────────────────────────────────

export interface InsertOpOpts {
	databaseId: number;
	origin: 'base' | 'user';
	state?: 'published' | 'draft' | 'superseded' | 'dropped';
	source?: 'local' | 'repo' | 'import';
	sql: string;
	sequence?: number;
	metadata?: string | null;
	desiredState?: string | null;
	contentHash?: string | null;
}

/**
 * Insert a pcd_ops row directly. Returns the inserted op id.
 */
export function insertOp(dbPath: string, opts: InsertOpOpts): number {
	const db = new Database(dbPath);
	try {
		db.exec(
			`INSERT INTO pcd_ops (
				database_id, origin, state, source,
				sql, sequence, metadata, desired_state, content_hash
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				opts.databaseId,
				opts.origin,
				opts.state ?? 'published',
				opts.source ?? 'local',
				opts.sql,
				opts.sequence ?? null,
				opts.metadata ?? null,
				opts.desiredState ?? null,
				opts.contentHash ?? null
			]
		);
		const row = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
		return row.id;
	} finally {
		db.close();
	}
}

// ─── PCD Repo on Disk ──────────────────────────────────────────────────────────

/**
 * Create a minimal PCD repo on disk with just the schema SQL.
 * This is all that `loadAllOperations` needs from disk — base/user ops come from DB.
 */
export async function createPcdRepo(basePath: string, uuid: string): Promise<string> {
	const pcdPath = `${basePath}/data/databases/${uuid}`;
	const schemaDir = `${pcdPath}/deps/schema/ops`;
	await Deno.mkdir(schemaDir, { recursive: true });

	// Copy PCD schema from docs
	const schema = await Deno.readTextFile('docs/pcdReference/0.schema.sql');
	await Deno.writeTextFile(`${schemaDir}/0.schema.sql`, schema);

	log.setup(`PCD repo created at ${pcdPath}`);
	return pcdPath;
}

// ─── Query Helpers ──────────────────────────────────────────────────────────────

export interface OpRow {
	id: number;
	database_id: number;
	origin: string;
	state: string;
	source: string;
	sql: string;
	sequence: number | null;
	metadata: string | null;
	desired_state: string | null;
	content_hash: string | null;
	superseded_by_op_id: number | null;
	created_at: string;
	updated_at: string;
}

export interface HistoryRow {
	id: number;
	op_id: number;
	database_id: number;
	batch_id: string;
	status: string;
	rowcount: number | null;
	conflict_reason: string | null;
	error: string | null;
	details: string | null;
	applied_at: string;
}

/**
 * Get a single pcd_ops row by id.
 */
export function queryOp(dbPath: string, opId: number): OpRow | undefined {
	const db = new Database(dbPath);
	try {
		return db.prepare('SELECT * FROM pcd_ops WHERE id = ?').get(opId) as OpRow | undefined;
	} finally {
		db.close();
	}
}

/**
 * Get all pcd_ops rows for a database, optionally filtered.
 */
export function queryOpsByDatabase(
	dbPath: string,
	databaseId: number,
	filters?: { origin?: string; state?: string }
): OpRow[] {
	const db = new Database(dbPath);
	try {
		const clauses = ['database_id = ?'];
		const params: (string | number)[] = [databaseId];
		if (filters?.origin) {
			clauses.push('origin = ?');
			params.push(filters.origin);
		}
		if (filters?.state) {
			clauses.push('state = ?');
			params.push(filters.state);
		}
		return db
			.prepare(`SELECT * FROM pcd_ops WHERE ${clauses.join(' AND ')} ORDER BY id`)
			.all(...params) as OpRow[];
	} finally {
		db.close();
	}
}

/**
 * Get the latest pcd_op_history entry for each op in a database,
 * filtered to conflicted/conflicted_pending statuses.
 */
export function queryLatestConflicts(dbPath: string, databaseId: number): HistoryRow[] {
	const db = new Database(dbPath);
	try {
		return db
			.prepare(
				`SELECT h.* FROM pcd_op_history h
				INNER JOIN (
					SELECT op_id, MAX(id) as max_id
					FROM pcd_op_history
					WHERE database_id = ?
					GROUP BY op_id
				) latest ON h.id = latest.max_id
				WHERE h.status IN ('conflicted', 'conflicted_pending')
				ORDER BY h.id`
			)
			.all(databaseId) as HistoryRow[];
	} finally {
		db.close();
	}
}

/**
 * Get all pcd_op_history entries for a specific op.
 */
export function queryAllHistory(dbPath: string, opId: number): HistoryRow[] {
	const db = new Database(dbPath);
	try {
		return db
			.prepare('SELECT * FROM pcd_op_history WHERE op_id = ? ORDER BY id DESC')
			.all(opId) as HistoryRow[];
	} finally {
		db.close();
	}
}

/**
 * Get the latest pcd_op_history entry for each op in a database (all statuses).
 */
export function queryLatestHistory(dbPath: string, databaseId: number): HistoryRow[] {
	const db = new Database(dbPath);
	try {
		return db
			.prepare(
				`SELECT h.* FROM pcd_op_history h
				INNER JOIN (
					SELECT op_id, MAX(id) as max_id
					FROM pcd_op_history
					WHERE database_id = ?
					GROUP BY op_id
				) latest ON h.id = latest.max_id
				ORDER BY h.id`
			)
			.all(databaseId) as HistoryRow[];
	} finally {
		db.close();
	}
}
