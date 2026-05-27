/**
 * PCD write tests: quality profile scoring update.
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

const PORT = PORTS.pcd.writeQualityProfilesScoringUpdate;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-quality-profile-scoring-update');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

test('upgrades allowed disable emits guarded op', async () => {
	const ctx = await seededPcd('upgrades-allowed-disable', [
		base.qualityProfile({
			name: 'Upgrade Toggle Profile'
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityProfile.updateScoring(ctx, 1, {
		upgradesAllowed: false
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = opForChangedField(ops, 'upgrades_allowed');
	assertEquals(parseDesiredState(op).upgrades_allowed, {
		from: true,
		to: false
	});

	const sql = normalizeSql(op.sql).toLowerCase();
	assert(sql.includes('upgrades_allowed" = 0'), `Expected disabled value, got ${sql}`);
	assert(sql.includes('upgrades_allowed" = 1'), `Expected current value guard, got ${sql}`);
});

test('upgrades allowed enable applies cleanly', async () => {
	const ctx = await seededPcd('upgrades-allowed-enable', [
		base.qualityProfile({
			name: 'Upgrade Toggle Profile',
			upgradesAllowed: false
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityProfile.updateScoring(ctx, 1, {
		upgradesAllowed: true
	});

	const op = opForChangedField(userOpsSince(ctx, checkpoint), 'upgrades_allowed');
	assertEquals(parseDesiredState(op).upgrades_allowed, {
		from: false,
		to: true
	});
	assertEquals(compiledUpgradesAllowed(ctx, 'Upgrade Toggle Profile'), 1);
});

function compiledUpgradesAllowed(ctx: PcdTestContext, name: string): number {
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
			.prepare('SELECT upgrades_allowed FROM quality_profiles WHERE name = ?')
			.get(name) as { upgrades_allowed: number } | undefined;
		assertExists(row, `Expected quality profile ${name}`);
		return row.upgrades_allowed;
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
