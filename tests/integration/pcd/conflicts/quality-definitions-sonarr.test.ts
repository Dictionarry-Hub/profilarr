/**
 * PCD conflict tests: sonarr quality definitions.
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

const PORT = PORTS.pcd.conflictsQualityDefinitionsSonarr;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

type SonarrQualityDefinitionsRow = {
	name: string;
	quality_name: string;
	min_size: number;
	max_size: number;
	preferred_size: number;
};

const SEED_TIERS = [
	{ quality_name: 'HDTV-720p', min_size: 1, max_size: 15, preferred_size: 8 },
	{ quality_name: 'WEBDL-1080p', min_size: 4, max_size: 40, preferred_size: 20 }
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
 *   Config 'Split QD' with HDTV-720p and WEBDL-1080p.
 *
 * User
 *   Submits update changing HDTV-720p sizes only.
 *
 * Upstream
 *   Published base op changes WEBDL-1080p sizes only.
 *
 * Expect
 *   Both apply cleanly under every strategy.
 */
test('split tier conflicts apply independently', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'split-tier', [
			base.sonarrQualityDefinitions({ name: 'Split QD', entries: SEED_TIERS })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityDefSonarr.update(ctx, 'Split QD', {
			name: 'Split QD',
			entries: [
				{ quality_name: 'HDTV-720p', min_size: 2, max_size: 18, preferred_size: 10 },
				{ quality_name: 'WEBDL-1080p', min_size: 4, max_size: 40, preferred_size: 20 }
			]
		});

		seedUpstream(
			ctx,
			upstreamTierUpdate('Split QD', 'WEBDL-1080p', {
				min_size: { from: 4, to: 5 },
				max_size: { from: 40, to: 45 },
				preferred_size: { from: 20, to: 22 }
			})
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const hdtvOp = firstOpForQualityName(ops, 'HDTV-720p');
		assertLatestHistory(ctx, hdtvOp, 'applied');

		const hdtvRow = assertQualityDefinition(ctx, 'Split QD', 'HDTV-720p');
		assertEquals(hdtvRow.min_size, 2);
		assertEquals(hdtvRow.max_size, 18);
		assertEquals(hdtvRow.preferred_size, 10);

		const webdlRow = assertQualityDefinition(ctx, 'Split QD', 'WEBDL-1080p');
		assertEquals(webdlRow.min_size, 5);
		assertEquals(webdlRow.max_size, 45);
		assertEquals(webdlRow.preferred_size, 22);
	}
});

/**
 * Base
 *   Config 'Same Tier QD' with SEED_TIERS.
 *
 * User
 *   Submits update changing HDTV-720p sizes.
 *
 * Upstream
 *   Published base op changes HDTV-720p sizes (different values).
 *
 * Expect
 *   User op conflicts (guard_mismatch). Override regenerates user values;
 *   align drops; ask leaves pending.
 */
test('same-tier conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'same-tier', [
			base.sonarrQualityDefinitions({ name: 'Same Tier QD', entries: SEED_TIERS })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityDefSonarr.update(ctx, 'Same Tier QD', {
			name: 'Same Tier QD',
			entries: [
				{ quality_name: 'HDTV-720p', min_size: 2, max_size: 18, preferred_size: 10 },
				{ quality_name: 'WEBDL-1080p', min_size: 4, max_size: 40, preferred_size: 20 }
			]
		});

		seedUpstream(
			ctx,
			upstreamTierUpdate('Same Tier QD', 'HDTV-720p', {
				min_size: { from: 1, to: 3 },
				max_size: { from: 15, to: 19 },
				preferred_size: { from: 8, to: 11 }
			})
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const hdtvOp = firstOpForQualityName(ops, 'HDTV-720p');
		assertStrategyOutcome(ctx, hdtvOp, strategy, 'guard_mismatch');

		const hdtvRow = assertQualityDefinition(ctx, 'Same Tier QD', 'HDTV-720p');
		if (strategy === 'override') {
			assertEquals(hdtvRow.min_size, 2);
			assertEquals(hdtvRow.max_size, 18);
			assertEquals(hdtvRow.preferred_size, 10);
		} else {
			assertEquals(hdtvRow.min_size, 3);
			assertEquals(hdtvRow.max_size, 19);
			assertEquals(hdtvRow.preferred_size, 11);
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
 *   Rename op conflicts. Override -> User QD; align/ask -> Upstream QD.
 */
test('rename conflict follows upstream rename by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'rename', [
			base.sonarrQualityDefinitions({ name: 'Old QD', entries: SEED_TIERS })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityDefSonarr.update(ctx, 'Old QD', {
			name: 'User QD',
			entries: SEED_TIERS
		});

		seedUpstream(ctx, upstreamRename('Old QD', 'Upstream QD'));
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const renameOp = firstOpForChangedFields(ops, ['name']);
		assertStrategyOutcome(ctx, renameOp, strategy, 'guard_mismatch');

		const allRows = compiledSonarrQualityDefinitions(ctx);
		const finalNames = new Set(allRows.map((row) => row.name));
		if (strategy === 'override') {
			assert(finalNames.has('User QD'));
			assert(!finalNames.has('Upstream QD'));
		} else {
			assert(finalNames.has('Upstream QD'));
			assert(!finalNames.has('User QD'));
		}
	}
});

/**
 * Base
 *   Config 'Old QD' with SEED_TIERS.
 *
 * User
 *   Submits rename to 'User QD' AND modifies HDTV-720p sizes.
 *
 * Upstream
 *   Published base rename to 'Upstream QD'.
 *
 * Expect
 *   Conflict page returns 200 and the upstream config name is rendered.
 */
test('conflict page field details follow upstream rename', async () => {
	const ctx = await seededScenario('ask', 'field-detail-upstream-rename', [
		base.sonarrQualityDefinitions({ name: 'Old QD', entries: SEED_TIERS })
	]);

	await write.qualityDefSonarr.update(ctx, 'Old QD', {
		name: 'User QD',
		entries: [
			{ quality_name: 'HDTV-720p', min_size: 2, max_size: 18, preferred_size: 10 },
			{ quality_name: 'WEBDL-1080p', min_size: 4, max_size: 40, preferred_size: 20 }
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
 *   Creates 'Create Conflict' with HDTV-720p (2/18/10), WEBDL-1080p (4/40/20).
 *
 * Upstream
 *   Published base create with same name, HDTV-720p (1/15/8), WEBDL-1080p (4/40/20).
 *
 * Expect
 *   Create op conflicts (duplicate_key). Override -> user values; align/ask
 *   -> upstream values.
 */
test('create duplicate conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'create-duplicate', [
			base.qualities({
				entries: [
					{ name: 'HDTV-720p', arrType: 'sonarr' },
					{ name: 'WEBDL-1080p', arrType: 'sonarr' }
				]
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityDefSonarr.create(ctx, {
			name: 'Create Conflict',
			entries: [
				{ quality_name: 'HDTV-720p', min_size: 2, max_size: 18, preferred_size: 10 },
				{ quality_name: 'WEBDL-1080p', min_size: 4, max_size: 40, preferred_size: 20 }
			]
		});

		seedUpstream(
			ctx,
			base.sonarrQualityDefinitions({ name: 'Create Conflict', entries: SEED_TIERS })
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const createOp = firstOpForOperation(ops, 'create');
		assertStrategyOutcome(ctx, createOp, strategy, 'duplicate_key');

		const hdtvRow = assertQualityDefinition(ctx, 'Create Conflict', 'HDTV-720p');
		if (strategy === 'override') {
			assertEquals(hdtvRow.min_size, 2);
			assertEquals(hdtvRow.max_size, 18);
			assertEquals(hdtvRow.preferred_size, 10);
		} else {
			assertEquals(hdtvRow.min_size, 1);
			assertEquals(hdtvRow.max_size, 15);
			assertEquals(hdtvRow.preferred_size, 8);
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
 *   Published base op modifies HDTV-720p sizes.
 *
 * Expect
 *   Delete applies cleanly under every strategy.
 */
test('delete applies cleanly after upstream tier change', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-after-tier-change', [
			base.sonarrQualityDefinitions({ name: 'Delete QD', entries: SEED_TIERS })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityDefSonarr.remove(ctx, 'Delete QD');

		seedUpstream(
			ctx,
			upstreamTierUpdate('Delete QD', 'HDTV-720p', {
				min_size: { from: 1, to: 3 },
				max_size: { from: 15, to: 19 },
				preferred_size: { from: 8, to: 11 }
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
			base.sonarrQualityDefinitions({ name: 'Already Deleted', entries: SEED_TIERS })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityDefSonarr.remove(ctx, 'Already Deleted');

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
		name: `pcd-conflict-quality-def-sonarr-${counter}-${strategy}-${name}`,
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
): SonarrQualityDefinitionsRow {
	const row = compiledSonarrQualityDefinitions(ctx).find(
		(r) => r.name === configName && r.quality_name === qualityName
	);
	assertExists(row, `Expected sonarr quality definitions row ${configName}/${qualityName}`);
	return row;
}

function assertNoQualityDefinition(ctx: PcdTestContext, configName: string): void {
	const rows = compiledSonarrQualityDefinitions(ctx).filter((r) => r.name === configName);
	assertEquals(rows.length, 0);
}

function compiledSonarrQualityDefinitions(ctx: PcdTestContext): SonarrQualityDefinitionsRow[] {
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
				 FROM sonarr_quality_definitions
				 ORDER BY name, quality_name`
			)
			.all() as SonarrQualityDefinitionsRow[];
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
			`UPDATE sonarr_quality_definitions SET ${setSql} ` +
			`WHERE name = ${sqlValue(configName)} AND quality_name = ${sqlValue(qualityName)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'sonarr_quality_definitions',
			name: configName,
			qualityName,
			stable_key: { key: 'sonarr_quality_definitions_name', value: configName },
			changed_fields: fields
		}),
		desiredState: JSON.stringify(changes)
	};
}

function upstreamRename(from: string, to: string): SeedOperation {
	return {
		sql: `UPDATE sonarr_quality_definitions SET name = ${sqlValue(to)} WHERE name = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'sonarr_quality_definitions',
			name: to,
			previousName: from,
			stable_key: { key: 'sonarr_quality_definitions_name', value: from },
			changed_fields: ['name']
		}),
		desiredState: JSON.stringify({ name: { from, to } })
	};
}

function upstreamDelete(name: string): SeedOperation {
	return {
		sql: `DELETE FROM sonarr_quality_definitions WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'delete',
			entity: 'sonarr_quality_definitions',
			name,
			stable_key: { key: 'sonarr_quality_definitions_name', value: name },
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
