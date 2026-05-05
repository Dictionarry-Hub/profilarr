/**
 * Shared PCD integration harness.
 */

import { assert } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { openDb } from '$test-harness/db.ts';
import { getDbPath } from '$test-harness/server.ts';

export type ConflictStrategy = 'override' | 'align' | 'ask';
export type OpOrigin = 'base' | 'user';
export type OpState = 'published' | 'draft' | 'superseded' | 'dropped';

export interface PcdTestContext {
	port: number;
	origin: string;
	basePath: string;
	dbPath: string;
	dbId: number;
	pcdPath: string;
	client: TestClient;
}

export interface SetupPcdOptions {
	port: number;
	name: string;
	uuid?: string;
	conflictStrategy?: ConflictStrategy;
	enabled?: boolean;
	canWriteToBase?: boolean;
}

export interface SeedOperation {
	sql: string;
	metadata?: string | null;
	desiredState?: string | null;
	contentHash?: string | null;
}

export interface InsertOpOptions extends SeedOperation {
	origin: OpOrigin;
	state?: OpState;
	source?: 'local' | 'repo' | 'import';
	sequence?: number;
}

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

export type JsonObject = Record<string, unknown>;

export async function setupPcd(options: SetupPcdOptions): Promise<PcdTestContext> {
	const origin = `http://localhost:${options.port}`;
	const basePath = `./dist/integration-${options.port}`;
	const dbPath = getDbPath(options.port);
	const uuid = options.uuid ?? options.name;
	const pcdPath = await createPcdRepo(basePath, uuid);
	const dbId = createDatabaseInstance(dbPath, {
		name: options.name,
		uuid,
		localPath: pcdPath,
		conflictStrategy: options.conflictStrategy ?? 'ask',
		enabled: options.enabled,
		canWriteToBase: options.canWriteToBase
	});

	return {
		port: options.port,
		origin,
		basePath,
		dbPath,
		dbId,
		pcdPath,
		client: new TestClient(origin)
	};
}

export async function createPcdRepo(basePath: string, uuid: string): Promise<string> {
	const pcdPath = `${basePath}/data/databases/${uuid}`;
	const schemaDir = `${pcdPath}/deps/schema/ops`;
	await Deno.mkdir(schemaDir, { recursive: true });

	const schema = await Deno.readTextFile('docs/backend/0.schema.sql');
	await Deno.writeTextFile(`${schemaDir}/0.schema.sql`, schema);

	return pcdPath;
}

function createDatabaseInstance(
	dbPath: string,
	opts: {
		name: string;
		uuid: string;
		localPath: string;
		conflictStrategy: ConflictStrategy;
		enabled?: boolean;
		canWriteToBase?: boolean;
	}
): number {
	const db = openDb(dbPath);
	try {
		db.exec(
			`INSERT INTO database_instances (
				uuid, name, repository_url, local_path,
				sync_strategy, auto_pull, enabled, is_private,
				personal_access_token, local_ops_enabled, conflict_strategy
			) VALUES (?, ?, '', ?, 60, 0, ?, 0, ?, ?, ?)`,
			[
				opts.uuid,
				opts.name,
				opts.localPath,
				opts.enabled !== false ? 1 : 0,
				opts.canWriteToBase ? 'test-token' : null,
				opts.canWriteToBase ? 0 : 1,
				opts.conflictStrategy
			]
		);
		const row = db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number };
		db.exec('UPDATE setup_state SET default_database_linked = 1 WHERE id = 1');
		return row.id;
	} finally {
		db.close();
	}
}

export function insertOp(ctx: PcdTestContext, opts: InsertOpOptions): number {
	const db = openDb(ctx.dbPath);
	try {
		db.exec(
			`INSERT INTO pcd_ops (
				database_id, origin, state, source,
				sql, sequence, metadata, desired_state, content_hash
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				ctx.dbId,
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
		const row = db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number };
		return row.id;
	} finally {
		db.close();
	}
}

export function seedBase(ctx: PcdTestContext, operations: Array<string | SeedOperation>): number[] {
	let sequence = nextSequence(ctx, 'base');
	return operations.map((operation) => {
		const seed = normalizeSeedOperation(operation);
		return insertOp(ctx, {
			...seed,
			origin: 'base',
			state: 'published',
			sequence: sequence++
		});
	});
}

export async function compilePcd(ctx: PcdTestContext): Promise<void> {
	const draftId = insertOp(ctx, {
		origin: 'base',
		state: 'draft',
		sql: 'SELECT 1;',
		sequence: nextSequence(ctx, 'base')
	});

	const response = await ctx.client.postForm(
		`/databases/${ctx.dbId}/changes?/drop`,
		{ opIds: String(draftId) },
		{ headers: { Origin: ctx.origin } }
	);

	assert(
		response.status >= 200 && response.status < 400,
		`Expected compile trigger to return 2xx/3xx, got ${response.status}`
	);
}

export function opCheckpoint(ctx: PcdTestContext): number {
	const db = openDb(ctx.dbPath);
	try {
		const row = db
			.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM pcd_ops WHERE database_id = ?')
			.get(ctx.dbId) as { id: number };
		return row.id;
	} finally {
		db.close();
	}
}

export function queryOpsSince(
	ctx: PcdTestContext,
	checkpoint: number,
	filters: { origin?: OpOrigin; state?: OpState } = {}
): OpRow[] {
	const db = openDb(ctx.dbPath);
	try {
		const clauses = ['database_id = ?', 'id > ?'];
		const params: Array<string | number> = [ctx.dbId, checkpoint];
		if (filters.origin) {
			clauses.push('origin = ?');
			params.push(filters.origin);
		}
		if (filters.state) {
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

export function parseMetadata(op: OpRow): JsonObject {
	return parseJsonObject(op.metadata);
}

export function parseDesiredState(op: OpRow): JsonObject {
	return parseJsonObject(op.desired_state);
}

export function normalizeSql(sql: string): string {
	return sql.replace(/\s+/g, ' ').trim();
}

function nextSequence(ctx: PcdTestContext, origin: OpOrigin): number {
	const db = openDb(ctx.dbPath);
	try {
		const row = db
			.prepare(
				`SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
				FROM pcd_ops
				WHERE database_id = ?
				  AND origin = ?`
			)
			.get(ctx.dbId, origin) as { sequence: number };
		return row.sequence;
	} finally {
		db.close();
	}
}

function normalizeSeedOperation(operation: string | SeedOperation): SeedOperation {
	if (typeof operation === 'string') {
		return { sql: operation };
	}
	return operation;
}

function parseJsonObject(value: string | null): JsonObject {
	if (!value) return {};
	const parsed = JSON.parse(value) as unknown;
	if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
		return parsed as JsonObject;
	}
	return {};
}
