/**
 * PCD conflict tests: custom format general include_in_rename.
 */

import { assertEquals, assertExists } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { openDb } from '$test-harness/db.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import {
	compilePcd,
	insertOp,
	opCheckpoint,
	parseMetadata,
	queryOpsSince,
	seedBase,
	setupPcd,
	type ConflictStrategy,
	type OpRow,
	type PcdTestContext,
	type SeedOperation
} from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';

const PORT = PORTS.pcd.conflictsCustomFormatsGeneral;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

type CustomFormatRow = {
	name: string;
	description: string | null;
	include_in_rename: number;
};

let counter = 0;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Base layer seeded with one custom format via base.customFormat():
 *     name='Include Auto Align', includeInRename=false
 *
 * User
 *   POST update changes:
 *     includeInRename = true
 *
 * Upstream
 *   Published base op changes:
 *     include_in_rename false -> true
 *
 * Expect
 *   - user include_in_rename op auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final include_in_rename is true
 */
test('matching upstream include_in_rename value auto-aligns user op', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'include-auto-align', [
			base.customFormat({
				name: 'Include Auto Align',
				includeInRename: false
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.update(ctx, 1, {
			name: 'Include Auto Align',
			includeInRename: true
		});

		seedUpstream(
			ctx,
			upstreamUpdate('Include Auto Align', {
				include_in_rename: { from: false, to: true }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['include_in_rename']);
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);

		const row = assertCustomFormat(ctx, 'Include Auto Align');
		assertEquals(row.include_in_rename, 1);
	}
});

async function newScenario(strategy: ConflictStrategy, name: string): Promise<PcdTestContext> {
	counter++;
	return setupPcd({
		port: PORT,
		name: `pcd-conflict-custom-format-general-${counter}-${strategy}-${name}`,
		conflictStrategy: strategy
	});
}

async function seededScenario(
	strategy: ConflictStrategy,
	name: string,
	operations: Array<string | SeedOperation>
): Promise<PcdTestContext> {
	const ctx = await newScenario(strategy, name);
	seedBase(ctx, operations);
	await compilePcd(ctx);
	return ctx;
}

function seedUpstream(ctx: PcdTestContext, operation: SeedOperation): number {
	return insertOp(ctx, {
		...operation,
		origin: 'base',
		state: 'published',
		source: 'repo'
	});
}

function opsSince(ctx: PcdTestContext, checkpoint: number): OpRow[] {
	return queryOpsSince(ctx, checkpoint, { origin: 'user' });
}

function firstOpForChangedFields(ops: OpRow[], fields: string[]): OpRow {
	const expected = [...fields].sort();
	const op = ops.find((candidate) => {
		const actual = changedFields(candidate).sort();
		return (
			actual.length === expected.length && actual.every((field, index) => field === expected[index])
		);
	});
	assertExists(op, `Expected a user op for ${fields.join(', ')}`);
	return op;
}

function changedFields(op: OpRow): string[] {
	const fields = parseMetadata(op).changed_fields;
	if (!Array.isArray(fields)) return [];
	return fields.filter((field): field is string => typeof field === 'string');
}

function assertLatestHistory(
	ctx: PcdTestContext,
	op: OpRow,
	status: string,
	reason?: string
): void {
	const history = latestHistory(ctx, op.id);
	assertEquals(history.status, status);
	if (reason !== undefined) {
		assertEquals(history.conflict_reason, reason);
	}
}

function latestHistory(ctx: PcdTestContext, opId: number): LatestHistory {
	const db = openDb(ctx.dbPath);
	try {
		const row = db
			.prepare(
				`SELECT status, conflict_reason
				 FROM pcd_op_history
				 WHERE database_id = ?
				   AND op_id = ?
				 ORDER BY applied_at DESC, id DESC
				 LIMIT 1`
			)
			.get(ctx.dbId, opId) as LatestHistory | undefined;
		assertExists(row, `Expected latest history for op ${opId}`);
		return row;
	} finally {
		db.close();
	}
}

function assertNoPendingConflicts(ctx: PcdTestContext): void {
	const db = openDb(ctx.dbPath);
	try {
		const row = db
			.prepare(
				`SELECT COUNT(*) AS count
				 FROM pcd_op_history h
				 INNER JOIN (
				     SELECT op_id, MAX(id) AS max_id
				     FROM pcd_op_history
				     WHERE database_id = ?
				     GROUP BY op_id
				 ) latest ON h.id = latest.max_id
				 WHERE h.status IN ('conflicted', 'conflicted_pending')`
			)
			.get(ctx.dbId) as { count: number };
		assertEquals(row.count, 0);
	} finally {
		db.close();
	}
}

function assertCustomFormat(ctx: PcdTestContext, name: string): CustomFormatRow {
	const row = compiledCustomFormats(ctx).find((format) => format.name === name);
	assertExists(row, `Expected custom format ${name}`);
	return row;
}

function compiledCustomFormats(ctx: PcdTestContext): CustomFormatRow[] {
	const source = openDb(ctx.dbPath);
	const replay = openDb(':memory:');

	try {
		replay.exec('PRAGMA foreign_keys = ON');
		replay.exec(Deno.readTextFileSync('docs/backend/0.schema.sql'));

		const baseOps = source
			.prepare(
				`SELECT *
				 FROM pcd_ops
				 WHERE database_id = ?
				   AND origin = 'base'
				   AND state = 'published'
				 ORDER BY COALESCE(sequence, id), id`
			)
			.all(ctx.dbId) as OpRow[];

		const userOps = source
			.prepare(
				`SELECT *
				 FROM pcd_ops
				 WHERE database_id = ?
				   AND origin = 'user'
				   AND state = 'published'
				 ORDER BY COALESCE(sequence, id), id`
			)
			.all(ctx.dbId) as OpRow[];
		const histories = latestHistories(source, ctx.dbId);

		for (const op of baseOps) {
			replay.exec(op.sql);
		}
		for (const op of userOps) {
			if (histories.get(op.id)?.status !== 'applied') continue;
			replay.exec(op.sql);
		}

		return replay
			.prepare(
				`SELECT name, description, include_in_rename
				 FROM custom_formats
				 ORDER BY name`
			)
			.all() as CustomFormatRow[];
	} finally {
		replay.close();
		source.close();
	}
}

function latestHistories(
	db: ReturnType<typeof openDb>,
	databaseId: number
): Map<number, LatestHistory> {
	const rows = db
		.prepare(
			`SELECT op_id, status, conflict_reason
			 FROM pcd_op_history
			 WHERE database_id = ?
			 ORDER BY applied_at ASC, id ASC`
		)
		.all(databaseId) as Array<LatestHistory & { op_id: number }>;
	const latest = new Map<number, LatestHistory>();
	for (const row of rows) {
		latest.set(row.op_id, row);
	}
	return latest;
}

function upstreamUpdate(
	name: string,
	changes: Record<string, { from: unknown; to: unknown }>
): SeedOperation {
	const fields = Object.keys(changes);
	const setSql = fields.map((field) => `${field} = ${sqlValue(changes[field].to)}`).join(', ');
	return {
		sql: `UPDATE custom_formats SET ${setSql} WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name,
			stable_key: { key: 'custom_format_name', value: name },
			changed_fields: fields
		}),
		desiredState: JSON.stringify(changes)
	};
}

function sqlValue(value: unknown): string {
	if (value === null || value === undefined) return 'NULL';
	if (typeof value === 'number') return String(value);
	if (typeof value === 'boolean') return value ? '1' : '0';
	return `'${String(value).replace(/'/g, "''")}'`;
}

await run();
