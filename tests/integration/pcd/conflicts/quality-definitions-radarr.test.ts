/**
 * PCD conflict tests: radarr quality definitions.
 */

import { assert, assertEquals, assertExists, assertStringIncludes } from '@std/assert';
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

const PORT = PORTS.pcd.conflictsQualityDefinitionsRadarr;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

type RadarrQualityDefinitionsRow = {
	name: string;
	quality_name: string;
	min_size: number;
	max_size: number;
	preferred_size: number;
};

const SEED_TIERS = [
	{ quality_name: 'Bluray-1080p', min_size: 5, max_size: 50, preferred_size: 30 },
	{ quality_name: 'WEBDL-720p', min_size: 1, max_size: 20, preferred_size: 10 }
];

let counter = 0;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Base
 *   Config 'Split QD' with Bluray-1080p (5/50/30), WEBDL-720p (1/20/10).
 *
 * User
 *   Submits update changing Bluray-1080p sizes only.
 *
 * Upstream
 *   Published base op changes WEBDL-720p sizes only.
 *
 * Expect
 *   Both apply cleanly under every strategy. Final cache reflects both
 *   changes since the per-row split makes the ops independent.
 */
test('split tier conflicts apply independently', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'split-tier', [
			base.radarrQualityDefinitions({ name: 'Split QD', entries: SEED_TIERS })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityDefRadarr.update(ctx, 'Split QD', {
			name: 'Split QD',
			entries: [
				{ quality_name: 'Bluray-1080p', min_size: 6, max_size: 55, preferred_size: 32 },
				{ quality_name: 'WEBDL-720p', min_size: 1, max_size: 20, preferred_size: 10 }
			]
		});

		seedUpstream(
			ctx,
			upstreamTierUpdate('Split QD', 'WEBDL-720p', {
				min_size: { from: 1, to: 2 },
				max_size: { from: 20, to: 22 },
				preferred_size: { from: 10, to: 12 }
			})
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const blurayOp = firstOpForQualityName(ops, 'Bluray-1080p');
		assertLatestHistory(ctx, blurayOp, 'applied');

		const blurayRow = assertQualityDefinition(ctx, 'Split QD', 'Bluray-1080p');
		assertEquals(blurayRow.min_size, 6);
		assertEquals(blurayRow.max_size, 55);
		assertEquals(blurayRow.preferred_size, 32);

		const webdlRow = assertQualityDefinition(ctx, 'Split QD', 'WEBDL-720p');
		assertEquals(webdlRow.min_size, 2);
		assertEquals(webdlRow.max_size, 22);
		assertEquals(webdlRow.preferred_size, 12);
	}
});

/**
 * Base
 *   Config 'Same Tier QD' with SEED_TIERS.
 *
 * User
 *   Submits update changing Bluray-1080p sizes.
 *
 * Upstream
 *   Published base op changes Bluray-1080p sizes (different values).
 *
 * Expect
 *   User op conflicts (guard_mismatch). Override regenerates with user values;
 *   align drops user op (upstream wins); ask leaves pending.
 */
test('same-tier conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'same-tier', [
			base.radarrQualityDefinitions({ name: 'Same Tier QD', entries: SEED_TIERS })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityDefRadarr.update(ctx, 'Same Tier QD', {
			name: 'Same Tier QD',
			entries: [
				{ quality_name: 'Bluray-1080p', min_size: 6, max_size: 55, preferred_size: 32 },
				{ quality_name: 'WEBDL-720p', min_size: 1, max_size: 20, preferred_size: 10 }
			]
		});

		seedUpstream(
			ctx,
			upstreamTierUpdate('Same Tier QD', 'Bluray-1080p', {
				min_size: { from: 5, to: 7 },
				max_size: { from: 50, to: 60 },
				preferred_size: { from: 30, to: 35 }
			})
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const blurayOp = firstOpForQualityName(ops, 'Bluray-1080p');
		assertStrategyOutcome(ctx, blurayOp, strategy, 'guard_mismatch');

		const blurayRow = assertQualityDefinition(ctx, 'Same Tier QD', 'Bluray-1080p');
		if (strategy === 'override') {
			assertEquals(blurayRow.min_size, 6);
			assertEquals(blurayRow.max_size, 55);
			assertEquals(blurayRow.preferred_size, 32);
		} else {
			assertEquals(blurayRow.min_size, 7);
			assertEquals(blurayRow.max_size, 60);
			assertEquals(blurayRow.preferred_size, 35);
		}
	}
});

/**
 * Base
 *   Config 'Old QD' with SEED_TIERS.
 *
 * User
 *   Renames to 'User QD'.
 *
 * Upstream
 *   Published base rename to 'Upstream QD'.
 *
 * Expect
 *   Rename op conflicts. Override yields 'User QD'; align/ask leave 'Upstream QD'.
 */
test('rename conflict follows upstream rename by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'rename', [
			base.radarrQualityDefinitions({ name: 'Old QD', entries: SEED_TIERS })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityDefRadarr.update(ctx, 'Old QD', {
			name: 'User QD',
			entries: SEED_TIERS
		});

		seedUpstream(ctx, upstreamRename('Old QD', 'Upstream QD'));
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const renameOp = firstOpForChangedFields(ops, ['name']);
		assertStrategyOutcome(ctx, renameOp, strategy, 'guard_mismatch');

		const allRows = compiledRadarrQualityDefinitions(ctx);
		const finalNames = new Set(allRows.map((row) => row.name));
		if (strategy === 'override') {
			assert(finalNames.has('User QD'), 'expected override to land on User QD');
			assert(!finalNames.has('Upstream QD'), 'expected Upstream QD to be renamed away');
		} else {
			assert(finalNames.has('Upstream QD'), 'expected upstream to win');
			assert(!finalNames.has('User QD'), 'expected User QD not to exist');
		}
	}
});

/**
 * Base
 *   Config 'Old QD' with SEED_TIERS.
 *
 * User
 *   Submits rename to 'User QD' AND modifies Bluray-1080p sizes.
 *
 * Upstream
 *   Published base rename to 'Upstream QD'.
 *
 * Expect
 *   Conflict page returns 200 and the upstream config name is rendered.
 *   (Per-tier upstream value rendering is a separate deferred concern.)
 */
test('conflict page field details follow upstream rename', async () => {
	const ctx = await seededScenario('ask', 'field-detail-upstream-rename', [
		base.radarrQualityDefinitions({ name: 'Old QD', entries: SEED_TIERS })
	]);

	await write.qualityDefRadarr.update(ctx, 'Old QD', {
		name: 'User QD',
		entries: [
			{ quality_name: 'Bluray-1080p', min_size: 6, max_size: 55, preferred_size: 32 },
			{ quality_name: 'WEBDL-720p', min_size: 1, max_size: 20, preferred_size: 10 }
		]
	});

	seedUpstream(ctx, upstreamRename('Old QD', 'Upstream QD'));
	await compilePcd(ctx);

	const response = await ctx.client.get(`/databases/${ctx.dbId}/conflicts`);
	assertEquals(response.status, 200);
	const body = await response.text();
	assertStringIncludes(body, 'Upstream QD');
});

/**
 * Base
 *   Empty (qualities seeded for FK targets).
 *
 * User
 *   Creates 'Create Conflict' with Bluray-1080p (6/55/32), WEBDL-720p (1/20/10).
 *
 * Upstream
 *   Published base create with same name, Bluray-1080p (5/50/30), WEBDL-720p (1/20/10).
 *
 * Expect
 *   Create op conflicts (duplicate_key). Override yields user values; align/ask
 *   leave upstream values.
 */
test('create duplicate conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'create-duplicate', [
			base.qualities({
				entries: [
					{ name: 'Bluray-1080p', arrType: 'radarr' },
					{ name: 'WEBDL-720p', arrType: 'radarr' }
				]
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityDefRadarr.create(ctx, {
			name: 'Create Conflict',
			entries: [
				{ quality_name: 'Bluray-1080p', min_size: 6, max_size: 55, preferred_size: 32 },
				{ quality_name: 'WEBDL-720p', min_size: 1, max_size: 20, preferred_size: 10 }
			]
		});

		seedUpstream(
			ctx,
			base.radarrQualityDefinitions({ name: 'Create Conflict', entries: SEED_TIERS })
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const createOp = firstOpForOperation(ops, 'create');
		assertStrategyOutcome(ctx, createOp, strategy, 'duplicate_key');

		const blurayRow = assertQualityDefinition(ctx, 'Create Conflict', 'Bluray-1080p');
		if (strategy === 'override') {
			assertEquals(blurayRow.min_size, 6);
			assertEquals(blurayRow.max_size, 55);
			assertEquals(blurayRow.preferred_size, 32);
		} else {
			assertEquals(blurayRow.min_size, 5);
			assertEquals(blurayRow.max_size, 50);
			assertEquals(blurayRow.preferred_size, 30);
		}
	}
});

/**
 * Base
 *   Config 'Delete QD' with SEED_TIERS.
 *
 * User
 *   Submits delete.
 *
 * Upstream
 *   Published base op modifies Bluray-1080p sizes.
 *
 * Expect
 *   Delete applies cleanly under every strategy (name-only guard).
 */
test('delete applies cleanly after upstream tier change', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-after-tier-change', [
			base.radarrQualityDefinitions({ name: 'Delete QD', entries: SEED_TIERS })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityDefRadarr.remove(ctx, 'Delete QD');

		seedUpstream(
			ctx,
			upstreamTierUpdate('Delete QD', 'Bluray-1080p', {
				min_size: { from: 5, to: 7 },
				max_size: { from: 50, to: 60 },
				preferred_size: { from: 30, to: 35 }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoQualityDefinition(ctx, 'Delete QD');
	}
});

/**
 * Base
 *   Config 'Already Deleted' with SEED_TIERS.
 *
 * User
 *   Submits delete.
 *
 * Upstream
 *   Published base op deletes the same config.
 *
 * Expect
 *   All strategies auto-align/drop the user delete; final config is absent.
 */
test('delete missing target auto-aligns', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-missing-target', [
			base.radarrQualityDefinitions({ name: 'Already Deleted', entries: SEED_TIERS })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityDefRadarr.remove(ctx, 'Already Deleted');

		seedUpstream(ctx, upstreamDelete('Already Deleted'));
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoQualityDefinition(ctx, 'Already Deleted');
	}
});

async function newScenario(strategy: ConflictStrategy, name: string): Promise<PcdTestContext> {
	counter++;
	return setupPcd({
		port: PORT,
		name: `pcd-conflict-quality-def-radarr-${counter}-${strategy}-${name}`,
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

function firstOpForOperation(ops: OpRow[], operation: string): OpRow {
	const op = ops.find((candidate) => parseMetadata(candidate).operation === operation);
	assertExists(op, `Expected a user ${operation} op`);
	return op;
}

function firstOpForQualityName(ops: OpRow[], qualityName: string): OpRow {
	const op = ops.find((candidate) => parseMetadata(candidate).qualityName === qualityName);
	assertExists(op, `Expected a user op for quality_name ${qualityName}`);
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

function assertQualityDefinition(
	ctx: PcdTestContext,
	configName: string,
	qualityName: string
): RadarrQualityDefinitionsRow {
	const row = compiledRadarrQualityDefinitions(ctx).find(
		(r) => r.name === configName && r.quality_name === qualityName
	);
	assertExists(row, `Expected radarr quality definitions row ${configName}/${qualityName}`);
	return row;
}

function assertNoQualityDefinition(ctx: PcdTestContext, configName: string): void {
	const rows = compiledRadarrQualityDefinitions(ctx).filter((r) => r.name === configName);
	assertEquals(rows.length, 0);
}

function compiledRadarrQualityDefinitions(ctx: PcdTestContext): RadarrQualityDefinitionsRow[] {
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
				`SELECT name, quality_name, min_size, max_size, preferred_size
				 FROM radarr_quality_definitions
				 ORDER BY name, quality_name`
			)
			.all() as RadarrQualityDefinitionsRow[];
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

function upstreamTierUpdate(
	configName: string,
	qualityName: string,
	changes: Record<string, { from: unknown; to: unknown }>
): SeedOperation {
	const fields = Object.keys(changes);
	const setSql = fields.map((field) => `${field} = ${sqlValue(changes[field].to)}`).join(', ');
	return {
		sql:
			`UPDATE radarr_quality_definitions SET ${setSql} ` +
			`WHERE name = ${sqlValue(configName)} AND quality_name = ${sqlValue(qualityName)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'radarr_quality_definitions',
			name: configName,
			qualityName,
			stable_key: { key: 'radarr_quality_definitions_name', value: configName },
			changed_fields: fields
		}),
		desiredState: JSON.stringify(changes)
	};
}

function upstreamRename(from: string, to: string): SeedOperation {
	return {
		sql: `UPDATE radarr_quality_definitions SET name = ${sqlValue(to)} WHERE name = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'radarr_quality_definitions',
			name: to,
			previousName: from,
			stable_key: { key: 'radarr_quality_definitions_name', value: from },
			changed_fields: ['name']
		}),
		desiredState: JSON.stringify({ name: { from, to } })
	};
}

function upstreamDelete(name: string): SeedOperation {
	return {
		sql: `DELETE FROM radarr_quality_definitions WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'delete',
			entity: 'radarr_quality_definitions',
			name,
			stable_key: { key: 'radarr_quality_definitions_name', value: name },
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
