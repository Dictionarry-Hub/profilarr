/**
 * PCD write tests: quality profile general update.
 */

import { assert, assertEquals, assertExists } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { openDb } from '$test-harness/db.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import {
	normalizeSql,
	opCheckpoint,
	parseDesiredState,
	type OpRow,
	type PcdTestContext
} from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import { createScenarioFactory, opForChangedField, userOpsSince } from './helpers.ts';

const PORT = PORTS.pcd.writeQualityProfilesGeneralUpdate;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-quality-profile-general-update');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Base layer seeded with one quality profile via base.qualityProfile():
 *     name='Nullable Profile', description=null
 *   Compiled.
 *
 * Submit
 *   POST /quality-profiles/{ctx.dbId}/1/general?/update with form fields:
 *     name        = 'Nullable Profile'  // unchanged
 *     description = 'Local description' // changed from NULL
 *     tags        = '[]'
 *     language    = ''
 *     layer       = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.changed_fields === ['description']
 *   - op.desired_state.description === { from: null, to: 'Local description' }
 *   - op.sql contains 'description is null'
 *   - op.sql does not contain "description = ''"
 */
test('description update from null guards with is null', async () => {
	const ctx = await seededPcd('null-description-guard', [
		base.qualityProfile({
			name: 'Nullable Profile',
			description: null
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityProfile.updateGeneral(ctx, 1, {
		name: 'Nullable Profile',
		description: 'Local description'
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = opForChangedField(ops, 'description');
	assertEquals(parseDesiredState(op).description, {
		from: null,
		to: 'Local description'
	});

	const sql = normalizeSql(op.sql).toLowerCase();
	assert(sql.includes('description" is null'), `Expected NULL guard, got ${sql}`);
	assert(!sql.includes(`description = ''`), `Expected no empty-string guard, got ${sql}`);
});

/**
 * Context
 *   Base layer seeded with one quality profile via base.qualityProfile():
 *     name='Applied Nullable Profile', description=null
 *   Compiled.
 *
 * Submit
 *   POST /quality-profiles/{ctx.dbId}/1/general?/update with form fields:
 *     name        = 'Applied Nullable Profile' // unchanged
 *     description = 'Applied description'      // changed from NULL
 *     tags        = '[]'
 *     language    = ''
 *     layer       = 'user'
 *
 * Expect
 *   - description op latest pcd_op_history.status === 'applied'
 *   - no latest pcd_op_history rows are conflicted or conflicted_pending
 *   - replayed compiled quality_profiles.description === 'Applied description'
 */
test('description update from null applies cleanly', async () => {
	const ctx = await seededPcd('null-description-applies', [
		base.qualityProfile({
			name: 'Applied Nullable Profile',
			description: null
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityProfile.updateGeneral(ctx, 1, {
		name: 'Applied Nullable Profile',
		description: 'Applied description'
	});

	const op = opForChangedField(userOpsSince(ctx, checkpoint), 'description');
	assertLatestHistory(ctx, op.id, 'applied');
	assertNoPendingConflicts(ctx);
	assertEquals(
		compiledQualityProfileDescription(ctx, 'Applied Nullable Profile'),
		'Applied description'
	);
});

function assertLatestHistory(ctx: PcdTestContext, opId: number, status: string): void {
	const row = latestHistory(ctx, opId);
	assertEquals(row.status, status);
}

function latestHistory(ctx: PcdTestContext, opId: number): { status: string } {
	const db = openDb(ctx.dbPath);
	try {
		const row = db
			.prepare(
				`SELECT status
				 FROM pcd_op_history
				 WHERE database_id = ?
				   AND op_id = ?
				 ORDER BY applied_at DESC, id DESC
				 LIMIT 1`
			)
			.get(ctx.dbId, opId) as { status: string } | undefined;
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

function compiledQualityProfileDescription(ctx: PcdTestContext, name: string): string | null {
	const source = openDb(ctx.dbPath);
	const replay = openDb(':memory:');

	try {
		replay.exec('PRAGMA foreign_keys = ON');
		replay.exec(Deno.readTextFileSync('docs/backend/0.schema.sql'));

		const ops = source
			.prepare(
				`SELECT *
				 FROM pcd_ops
				 WHERE database_id = ?
				   AND (
				       (origin = 'base' AND state = 'published')
				       OR (origin = 'user' AND state = 'published')
				   )
				 ORDER BY
				   CASE origin WHEN 'base' THEN 0 ELSE 1 END,
				   COALESCE(sequence, id),
				   id`
			)
			.all(ctx.dbId) as OpRow[];
		const histories = latestHistories(source, ctx.dbId);

		for (const op of ops) {
			if (op.origin === 'user' && histories.get(op.id) !== 'applied') continue;
			replay.exec(op.sql);
		}

		const row = replay
			.prepare('SELECT description FROM quality_profiles WHERE name = ?')
			.get(name) as { description: string | null } | undefined;
		assertExists(row, `Expected quality profile ${name}`);
		return row.description;
	} finally {
		replay.close();
		source.close();
	}
}

function latestHistories(db: ReturnType<typeof openDb>, databaseId: number): Map<number, string> {
	const rows = db
		.prepare(
			`SELECT op_id, status
			 FROM pcd_op_history
			 WHERE database_id = ?
			 ORDER BY applied_at ASC, id ASC`
		)
		.all(databaseId) as Array<{ op_id: number; status: string }>;
	const latest = new Map<number, string>();
	for (const row of rows) {
		latest.set(row.op_id, row.status);
	}
	return latest;
}

run();
