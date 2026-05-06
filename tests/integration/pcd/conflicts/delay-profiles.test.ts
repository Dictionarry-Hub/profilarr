/**
 * PCD conflict tests: delay profiles.
 */

import { assert, assertEquals, assertExists } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { openDb } from '$test-harness/db.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../harness/fixtures.ts';
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
} from '../harness/pcd.ts';
import { write } from '../harness/write.ts';

const PORT = PORTS.pcd.conflictsDelayProfiles;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

type DelayProfileRow = {
	name: string;
	preferred_protocol: string;
	usenet_delay: number | null;
	torrent_delay: number | null;
	bypass_if_highest_quality: number;
	bypass_if_above_custom_format_score: number;
	minimum_custom_format_score: number | null;
};

let counter = 0;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Base
 *   Delay profile:
 *     name='Split Conflict', preferredProtocol='prefer_usenet',
 *     usenetDelay=10, torrentDelay=20
 *
 * User
 *   POST update changes:
 *     usenetDelay  = 15
 *     torrentDelay = 25
 *
 * Upstream
 *   Published base op changes:
 *     usenetDelay 10 -> 12
 *
 * Expect
 *   - ask: usenet_delay is conflicted_pending, torrent_delay applies
 *   - align: usenet_delay is dropped/aligned, torrent_delay applies
 *   - override: usenet_delay is superseded by a replacement, torrent_delay applies
 *   - final torrent_delay is 25 for every strategy
 *   - final usenet_delay is 15 only for override, otherwise 12
 */
test('split scalar conflicts resolve per field by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'split-scalar', [
			base.delayProfile({
				name: 'Split Conflict',
				preferredProtocol: 'prefer_usenet',
				usenetDelay: 10,
				torrentDelay: 20
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.delayProfile.update(ctx, 'Split Conflict', {
			name: 'Split Conflict',
			preferredProtocol: 'prefer_usenet',
			usenetDelay: 15,
			torrentDelay: 25
		});

		seedUpstream(ctx, upstreamUpdate('Split Conflict', { usenet_delay: { from: 10, to: 12 } }));
		await compilePcd(ctx);

		const ops = userOpsSince(ctx, checkpoint);
		const usenetOp = firstOpForChangedFields(ops, ['usenet_delay']);
		const torrentOp = firstOpForChangedFields(ops, ['torrent_delay']);

		assertStrategyOutcome(ctx, usenetOp, strategy, 'guard_mismatch');
		assertLatestHistory(ctx, torrentOp, 'applied');

		const row = assertDelayProfile(ctx, 'Split Conflict');
		assertEquals(row.usenet_delay, strategy === 'override' ? 15 : 12);
		assertEquals(row.torrent_delay, 25);
	}
});

/**
 * Base
 *   Delay profile:
 *     name='Protocol Pair', preferredProtocol='prefer_usenet',
 *     usenetDelay=10, torrentDelay=20
 *
 * User
 *   POST update changes:
 *     preferredProtocol = 'only_torrent'
 *     usenetDelay       = null via writer normalization
 *
 * Upstream
 *   Published base op changes:
 *     usenetDelay 10 -> 12
 *
 * Expect
 *   - grouped ['preferred_protocol', 'usenet_delay'] op conflicts as one unit
 *   - preferred_protocol does not partially apply for ask or align
 *   - override reapplies both fields against the upstream row
 */
test('protocol constrained pair conflicts atomically', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'protocol-pair', [
			base.delayProfile({
				name: 'Protocol Pair',
				preferredProtocol: 'prefer_usenet',
				usenetDelay: 10,
				torrentDelay: 20
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.delayProfile.update(ctx, 'Protocol Pair', {
			name: 'Protocol Pair',
			preferredProtocol: 'only_torrent',
			usenetDelay: 10,
			torrentDelay: 20
		});

		seedUpstream(ctx, upstreamUpdate('Protocol Pair', { usenet_delay: { from: 10, to: 12 } }));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			'preferred_protocol',
			'usenet_delay'
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		const row = assertDelayProfile(ctx, 'Protocol Pair');
		assertEquals(
			row.preferred_protocol,
			strategy === 'override' ? 'only_torrent' : 'prefer_usenet'
		);
		assertEquals(row.usenet_delay, strategy === 'override' ? null : 12);
	}
});

/**
 * Base
 *   Delay profile:
 *     name='Bypass Pair', bypassIfAboveCfScore=true,
 *     minimumCfScore=80
 *
 * User
 *   POST update changes:
 *     bypassIfAboveCfScore = false
 *     minimumCfScore       = null via writer normalization
 *
 * Upstream
 *   Published base op changes:
 *     minimumCfScore 80 -> 90
 *
 * Expect
 *   - grouped [
 *       'bypass_if_above_custom_format_score',
 *       'minimum_custom_format_score'
 *     ] op conflicts as one unit
 *   - bypass flag does not partially apply for ask or align
 *   - override reapplies both fields against the upstream row
 */
test('bypass score constrained pair conflicts atomically', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'bypass-pair', [
			base.delayProfile({
				name: 'Bypass Pair',
				bypassIfAboveCfScore: true,
				minimumCfScore: 80
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.delayProfile.update(ctx, 'Bypass Pair', {
			name: 'Bypass Pair',
			preferredProtocol: 'prefer_usenet',
			usenetDelay: 0,
			torrentDelay: 0,
			bypassIfAboveCfScore: false,
			minimumCfScore: 80
		});

		seedUpstream(
			ctx,
			upstreamUpdate('Bypass Pair', {
				minimum_custom_format_score: { from: 80, to: 90 }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			'bypass_if_above_custom_format_score',
			'minimum_custom_format_score'
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		const row = assertDelayProfile(ctx, 'Bypass Pair');
		assertEquals(row.bypass_if_above_custom_format_score, strategy === 'override' ? 0 : 1);
		assertEquals(row.minimum_custom_format_score, strategy === 'override' ? null : 90);
	}
});

/**
 * Base
 *   Delay profile:
 *     name='Old Delay'
 *
 * User
 *   POST update changes:
 *     name = 'User Delay'
 *
 * Upstream
 *   Published base rename changes:
 *     name 'Old Delay' -> 'Upstream Delay'
 *
 * Expect
 *   - ask: rename op is conflicted_pending
 *   - align: rename op is dropped/aligned
 *   - override: rename op is superseded and final row is 'User Delay'
 */
test('rename conflict follows upstream rename by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'rename', [
			base.delayProfile({ name: 'Old Delay' })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.delayProfile.update(ctx, 'Old Delay', {
			name: 'User Delay',
			preferredProtocol: 'prefer_usenet',
			usenetDelay: 0,
			torrentDelay: 0
		});

		seedUpstream(ctx, upstreamRename('Old Delay', 'Upstream Delay'));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['name']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		if (strategy === 'override') {
			assertDelayProfile(ctx, 'User Delay');
			assertNoDelayProfile(ctx, 'Upstream Delay');
		} else {
			assertDelayProfile(ctx, 'Upstream Delay');
			assertNoDelayProfile(ctx, 'User Delay');
		}
	}
});

/**
 * Base
 *   Empty PCD.
 *
 * User
 *   POST create delay profile:
 *     name='Create Conflict'
 *     usenetDelay=10
 *
 * Upstream
 *   Published base create:
 *     name='Create Conflict'
 *     usenetDelay=20
 *
 * Expect
 *   - ask: user create op is conflicted_pending, reason='duplicate_key'
 *   - align: user create op is dropped/aligned
 *   - override: user create op is superseded by a replacement update op
 *   - final usenet_delay is 10 only for override, otherwise 20
 */
test('create duplicate conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await newScenario(strategy, 'create-duplicate');
		await compilePcd(ctx);
		const checkpoint = opCheckpoint(ctx);

		await write.delayProfile.create(ctx, {
			name: 'Create Conflict',
			usenetDelay: 10
		});

		seedUpstream(ctx, base.delayProfile({ name: 'Create Conflict', usenetDelay: 20 }));
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'create');
		assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');

		const row = assertDelayProfile(ctx, 'Create Conflict');
		assertEquals(row.usenet_delay, strategy === 'override' ? 10 : 20);
	}
});

/**
 * Base
 *   Delay profile:
 *     name='Delete Conflict', usenetDelay=10
 *
 * User
 *   POST delete delay profile.
 *
 * Upstream
 *   Published base op changes:
 *     usenetDelay 10 -> 20
 *
 * Expect (verifies the name-only delete guard)
 *   - user delete op stays state='published' and history.status='applied' for
 *     every strategy. The delete only guards by name, which still matches
 *     after upstream changed an unrelated field.
 *   - final row is absent.
 */
test('delete applies cleanly after upstream non-name field change', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-after-field-change', [
			base.delayProfile({ name: 'Delete Conflict', usenetDelay: 10 })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.delayProfile.remove(ctx, 'Delete Conflict');

		seedUpstream(ctx, upstreamUpdate('Delete Conflict', { usenet_delay: { from: 10, to: 20 } }));
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoDelayProfile(ctx, 'Delete Conflict');
	}
});

/**
 * Base
 *   Delay profile:
 *     name='Already Deleted'
 *
 * User
 *   POST delete delay profile.
 *
 * Upstream
 *   Published base delete removes the same row.
 *
 * Expect
 *   - all strategies: user delete auto-aligns/drops because the target is gone
 *   - no pending conflict remains
 *   - final row is absent
 */
test('delete missing target auto-aligns', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-missing-target', [
			base.delayProfile({ name: 'Already Deleted' })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.delayProfile.remove(ctx, 'Already Deleted');

		seedUpstream(ctx, upstreamDelete('Already Deleted'));
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoDelayProfile(ctx, 'Already Deleted');
	}
});

async function newScenario(strategy: ConflictStrategy, name: string): Promise<PcdTestContext> {
	counter++;
	return setupPcd({
		port: PORT,
		name: `pcd-conflict-delay-profile-${counter}-${strategy}-${name}`,
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

function userOpsSince(ctx: PcdTestContext, checkpoint: number): OpRow[] {
	return opsSince(ctx, checkpoint);
}

function firstOpForOperation(ops: OpRow[], operation: string): OpRow {
	const op = ops.find((candidate) => parseMetadata(candidate).operation === operation);
	assertExists(op, `Expected a user ${operation} op`);
	return op;
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

function assertStrategyOutcome(
	ctx: PcdTestContext,
	op: OpRow,
	strategy: ConflictStrategy,
	reason: string
): void {
	if (strategy === 'ask') {
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'conflicted_pending', reason);
		return;
	}

	if (strategy === 'align') {
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		return;
	}

	assertEquals(op.state, 'superseded');
	assert(op.superseded_by_op_id !== null, 'Expected override to link a replacement op');
	assertLatestHistory(ctx, op, 'superseded');
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

function assertDelayProfile(ctx: PcdTestContext, name: string): DelayProfileRow {
	const row = compiledDelayProfiles(ctx).find((profile) => profile.name === name);
	assertExists(row, `Expected delay profile ${name}`);
	return row;
}

function assertNoDelayProfile(ctx: PcdTestContext, name: string): void {
	const row = compiledDelayProfiles(ctx).find((profile) => profile.name === name);
	assertEquals(row, undefined);
}

function compiledDelayProfiles(ctx: PcdTestContext): DelayProfileRow[] {
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
				`SELECT name,
				        preferred_protocol,
				        usenet_delay,
				        torrent_delay,
				        bypass_if_highest_quality,
				        bypass_if_above_custom_format_score,
				        minimum_custom_format_score
				 FROM delay_profiles
				 ORDER BY name`
			)
			.all() as DelayProfileRow[];
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
		sql: `UPDATE delay_profiles SET ${setSql} WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'delay_profile',
			name,
			stable_key: { key: 'delay_profile_name', value: name },
			changed_fields: fields
		}),
		desiredState: JSON.stringify(changes)
	};
}

function upstreamRename(from: string, to: string): SeedOperation {
	return {
		sql: `UPDATE delay_profiles SET name = ${sqlValue(to)} WHERE name = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'delay_profile',
			name: to,
			previousName: from,
			stable_key: { key: 'delay_profile_name', value: from },
			changed_fields: ['name']
		}),
		desiredState: JSON.stringify({ name: { from, to } })
	};
}

function upstreamDelete(name: string): SeedOperation {
	return {
		sql: `DELETE FROM delay_profiles WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'delete',
			entity: 'delay_profile',
			name,
			stable_key: { key: 'delay_profile_name', value: name },
			changed_fields: ['deleted']
		}),
		desiredState: JSON.stringify({ deleted: true, name })
	};
}

function sqlValue(value: unknown): string {
	if (value === null || value === undefined) return 'NULL';
	if (typeof value === 'number') return String(value);
	if (typeof value === 'boolean') return value ? '1' : '0';
	return `'${String(value).replace(/'/g, "''")}'`;
}

await run();
