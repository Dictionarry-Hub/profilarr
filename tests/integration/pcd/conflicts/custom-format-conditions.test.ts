/**
 * PCD conflict tests: custom format conditions.
 */

import { assertEquals, assertExists } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { openDb } from '$test-harness/db.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import type { ConditionData } from '$shared/pcd/display.ts';
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

const PORT = PORTS.pcd.conflictsCustomFormatConditions;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];
const FORMAT_NAME = 'x265';
const CONDITION_NAME = 'Not 2160p';
const ORIGINAL_RESOLUTION = '2160p';
const CONDITION_A = 'E2E Cond A 1.15';
const CONDITION_B = 'E2E Cond B 1.15';
const LOCAL_SOURCE = 'Bluray';
const UPSTREAM_SOURCE = 'WEB-DL';
const CONDITION_A_INITIAL_SOURCE = 'Bluray';
const CONDITION_B_INITIAL_SOURCE = 'WEB-DL';
const LOCAL_A_SOURCE = 'DVD';
const LOCAL_B_SOURCE = 'Television';
const UPSTREAM_B_SOURCE = 'WEBRip';
const UPSTREAM_C_RESOLUTION = '720p';

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

type ConditionRow = {
	custom_format_name: string;
	name: string;
	type: string;
	arr_type: string;
	negate: number;
	required: number;
};

type ResolutionRow = {
	custom_format_name: string;
	condition_name: string;
	resolution: string;
};

type SourceRow = {
	custom_format_name: string;
	condition_name: string;
	source: string;
};

let counter = 0;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Migrates old 1.5 and 1.13.
 *
 * Context
 *   Base layer seeded with one custom format resolution condition:
 *     format='x265', condition='Not 2160p', resolution='2160p'
 *
 * User
 *   POST conditions update changes:
 *     condition 'Not 2160p' resolution = '1080p'
 *
 * Upstream
 *   Published base op changes:
 *     condition 'Not 2160p' resolution '2160p' -> '720p'
 *
 * Expect
 *   - condition op conflicts by strategy
 *   - final resolution is user value only for override, otherwise upstream
 */
test('same condition resolution conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-resolution-conflict');
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			resolutionCondition(CONDITION_NAME, '1080p')
		]);

		seedUpstream(
			ctx,
			upstreamUpdateResolution(FORMAT_NAME, CONDITION_NAME, ORIGINAL_RESOLUTION, '720p')
		);
		await compilePcd(ctx);

		const op = firstOpForCondition(opsSince(ctx, checkpoint), CONDITION_NAME);
		assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');

		assertConditionResolution(
			ctx,
			FORMAT_NAME,
			CONDITION_NAME,
			strategy === 'override' ? '1080p' : '720p'
		);
	}
});

/**
 * Context
 *   Base layer seeded with one custom format resolution condition:
 *     format='x265', condition='Not 2160p', resolution='2160p'
 *
 * User
 *   POST conditions update changes:
 *     condition 'Not 2160p' type='source', source='Bluray'
 *
 * Upstream
 *   Published base op changes the same condition to:
 *     type='source', source='WEB-DL'
 *
 * Expect
 *   - condition op conflicts by strategy
 *   - final source is user value only for override, otherwise upstream
 */
test('condition type and source value conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-type-source-conflict');
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			sourceCondition(CONDITION_NAME, LOCAL_SOURCE, true)
		]);

		seedUpstream(
			ctx,
			upstreamChangeResolutionToSource(
				FORMAT_NAME,
				CONDITION_NAME,
				ORIGINAL_RESOLUTION,
				UPSTREAM_SOURCE
			)
		);
		await compilePcd(ctx);

		const op = firstOpForCondition(opsSince(ctx, checkpoint), CONDITION_NAME);
		assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');

		assertConditionSource(
			ctx,
			FORMAT_NAME,
			CONDITION_NAME,
			strategy === 'override' ? LOCAL_SOURCE : UPSTREAM_SOURCE
		);
	}
});

/**
 * Context
 *   Base layer seeded with three custom format conditions:
 *     A source='Bluray', B source='WEB-DL', C resolution='2160p'
 *
 * User
 *   POST conditions update changes:
 *     A source='DVD'
 *     B source='Television'
 *
 * Upstream
 *   Published base ops change:
 *     B source='WEBRip'
 *     C resolution='720p'
 *
 * Expect
 *   - A applies cleanly for every strategy
 *   - B conflicts by strategy
 *   - C keeps upstream value for every strategy
 */
test('multiple condition changes isolate overlapping conflict', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'multiple-condition-conflicts', [
			multiConditionSeed()
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			sourceCondition(CONDITION_A, LOCAL_A_SOURCE),
			sourceCondition(CONDITION_B, LOCAL_B_SOURCE),
			resolutionCondition(CONDITION_NAME, ORIGINAL_RESOLUTION)
		]);

		seedUpstream(
			ctx,
			upstreamUpdateSource(FORMAT_NAME, CONDITION_B, CONDITION_B_INITIAL_SOURCE, UPSTREAM_B_SOURCE)
		);
		seedUpstream(
			ctx,
			upstreamUpdateResolution(
				FORMAT_NAME,
				CONDITION_NAME,
				ORIGINAL_RESOLUTION,
				UPSTREAM_C_RESOLUTION
			)
		);
		await compilePcd(ctx);

		const userOps = opsSince(ctx, checkpoint);
		const opA = firstOpForCondition(userOps, CONDITION_A);
		assertEquals(opA.state, 'published');
		assertLatestHistory(ctx, opA, 'applied');

		const opB = firstOpForCondition(userOps, CONDITION_B);
		assertStrategyOutcome(ctx, opB, strategy, 'duplicate_key');

		assertConditionSource(ctx, FORMAT_NAME, CONDITION_A, LOCAL_A_SOURCE);
		assertConditionSource(
			ctx,
			FORMAT_NAME,
			CONDITION_B,
			strategy === 'override' ? LOCAL_B_SOURCE : UPSTREAM_B_SOURCE
		);
		assertConditionResolution(ctx, FORMAT_NAME, CONDITION_NAME, UPSTREAM_C_RESOLUTION);
	}
});

/**
 * Context
 *   Base layer seeded with one custom format resolution condition:
 *     format='x265', condition='Not 2160p', resolution='2160p'
 *
 * User
 *   POST conditions update changes:
 *     condition 'Not 2160p' resolution = '1080p'
 *
 * Upstream
 *   Published base op adds:
 *     condition='Upstream 720p', resolution='720p'
 *
 * Expect
 *   - user condition op applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - final state has the user-updated condition plus the upstream-added condition
 */
test('local condition update applies when upstream adds different condition', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-add-no-conflict');
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			resolutionCondition(CONDITION_NAME, '1080p')
		]);

		seedUpstream(ctx, upstreamAddResolution(FORMAT_NAME, 'Upstream 720p', '720p'));
		await compilePcd(ctx);

		const op = firstOpForCondition(opsSince(ctx, checkpoint), CONDITION_NAME);
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);

		assertConditionResolution(ctx, FORMAT_NAME, CONDITION_NAME, '1080p');
		assertConditionResolution(ctx, FORMAT_NAME, 'Upstream 720p', '720p');
	}
});

/**
 * Context
 *   Base layer seeded with one custom format resolution condition:
 *     format='x265', condition='Not 2160p', resolution='2160p'
 *
 * User
 *   POST conditions update changes:
 *     condition 'Not 2160p' resolution = '1080p'
 *
 * Upstream
 *   Published base delete removes:
 *     condition='Not 2160p'
 *
 * Expect
 *   - condition op conflicts by strategy
 *   - override recreates the condition with the user value
 *   - ask/align leave the condition deleted
 */
test('local condition update conflicts when upstream deletes condition', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-upstream-deleted');
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			resolutionCondition(CONDITION_NAME, '1080p')
		]);

		seedUpstream(ctx, upstreamDeleteCondition(FORMAT_NAME, CONDITION_NAME));
		await compilePcd(ctx);

		const op = firstOpForCondition(opsSince(ctx, checkpoint), CONDITION_NAME);
		assertStrategyOutcome(ctx, op, strategy, 'missing_target');

		if (strategy === 'override') {
			assertConditionResolution(ctx, FORMAT_NAME, CONDITION_NAME, '1080p');
		} else {
			assertNoCondition(ctx, FORMAT_NAME, CONDITION_NAME);
		}
	}
});

async function newScenario(strategy: ConflictStrategy, name: string): Promise<PcdTestContext> {
	counter++;
	return setupPcd({
		port: PORT,
		name: `pcd-conflict-custom-format-conditions-${counter}-${strategy}-${name}`,
		conflictStrategy: strategy
	});
}

async function seededScenario(
	strategy: ConflictStrategy,
	name: string,
	operations?: Array<string | SeedOperation>
): Promise<PcdTestContext> {
	const ctx = await newScenario(strategy, name);
	seedBase(
		ctx,
		operations ?? [
			base.customFormatResolutionCondition({
				formatName: FORMAT_NAME,
				conditionName: CONDITION_NAME,
				resolution: ORIGINAL_RESOLUTION,
				negate: true
			})
		]
	);
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

function resolutionCondition(name: string, resolution: string): ConditionData {
	return {
		name,
		type: 'resolution',
		arrType: 'all',
		negate: true,
		required: false,
		resolutions: [resolution]
	};
}

function sourceCondition(name: string, source: string, negate = false): ConditionData {
	return {
		name,
		type: 'source',
		arrType: 'all',
		negate,
		required: false,
		sources: [source]
	};
}

function opsSince(ctx: PcdTestContext, checkpoint: number): OpRow[] {
	return queryOpsSince(ctx, checkpoint, { origin: 'user' });
}

function firstOpForCondition(ops: OpRow[], conditionName: string): OpRow {
	const op = ops.find((candidate) => changedFields(candidate).includes(`condition:${conditionName}`));
	assertExists(op, `Expected a user op for condition ${conditionName}`);
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
	assertExists(op.superseded_by_op_id, 'Expected override to link a replacement op');
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

function assertConditionResolution(
	ctx: PcdTestContext,
	formatName: string,
	conditionName: string,
	resolution: string
): void {
	assertCondition(ctx, formatName, conditionName);
	const row = compiledConditionState(ctx).resolutions.find(
		(candidate) =>
			candidate.custom_format_name === formatName && candidate.condition_name === conditionName
	);
	assertExists(row, `Expected resolution for ${conditionName}`);
	assertEquals(row.resolution, resolution);
}

function assertConditionSource(
	ctx: PcdTestContext,
	formatName: string,
	conditionName: string,
	source: string
): void {
	const condition = assertCondition(ctx, formatName, conditionName);
	assertEquals(condition.type, 'source');
	const row = compiledConditionState(ctx).sources.find(
		(candidate) =>
			candidate.custom_format_name === formatName && candidate.condition_name === conditionName
	);
	assertExists(row, `Expected source for ${conditionName}`);
	assertEquals(row.source, source);
}

function assertCondition(
	ctx: PcdTestContext,
	formatName: string,
	conditionName: string
): ConditionRow {
	const row = compiledConditionState(ctx).conditions.find(
		(candidate) => candidate.custom_format_name === formatName && candidate.name === conditionName
	);
	assertExists(row, `Expected condition ${conditionName}`);
	return row;
}

function assertNoCondition(ctx: PcdTestContext, formatName: string, conditionName: string): void {
	const row = compiledConditionState(ctx).conditions.find(
		(candidate) => candidate.custom_format_name === formatName && candidate.name === conditionName
	);
	assertEquals(row, undefined);
}

function compiledConditionState(ctx: PcdTestContext): {
	conditions: ConditionRow[];
	resolutions: ResolutionRow[];
	sources: SourceRow[];
} {
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

		const conditions = replay
			.prepare(
				`SELECT custom_format_name, name, type, arr_type, negate, required
				 FROM custom_format_conditions
				 ORDER BY custom_format_name, name`
			)
			.all() as ConditionRow[];
		const resolutions = replay
			.prepare(
				`SELECT custom_format_name, condition_name, resolution
				 FROM condition_resolutions
				 ORDER BY custom_format_name, condition_name`
			)
			.all() as ResolutionRow[];
		const sources = replay
			.prepare(
				`SELECT custom_format_name, condition_name, source
				 FROM condition_sources
				 ORDER BY custom_format_name, condition_name`
			)
			.all() as SourceRow[];

		return { conditions, resolutions, sources };
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

function upstreamUpdateResolution(
	formatName: string,
	conditionName: string,
	from: string,
	to: string
): SeedOperation {
	return {
		sql: `UPDATE condition_resolutions
		      SET resolution = ${sqlValue(to)}
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND condition_name = ${sqlValue(conditionName)}
		        AND resolution = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name: formatName,
			stable_key: { key: 'custom_format_name', value: formatName },
			changed_fields: ['conditions', `condition:${conditionName}`]
		}),
		desiredState: JSON.stringify({
			conditions: {
				updated: [
					{
						name: conditionName,
						base: {
							from: { type: 'resolution', arrType: 'all', negate: true, required: false },
							to: { type: 'resolution', arrType: 'all', negate: true, required: false }
						},
						values: {
							from: { resolutions: [from] },
							to: { resolutions: [to] }
						}
					}
				]
			}
		})
	};
}

function upstreamUpdateSource(
	formatName: string,
	conditionName: string,
	from: string,
	to: string
): SeedOperation {
	return {
		sql: `UPDATE condition_sources
		      SET source = ${sqlValue(to)}
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND condition_name = ${sqlValue(conditionName)}
		        AND source = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name: formatName,
			stable_key: { key: 'custom_format_name', value: formatName },
			changed_fields: ['conditions', `condition:${conditionName}`]
		}),
		desiredState: JSON.stringify({
			conditions: {
				updated: [
					{
						name: conditionName,
						base: {
							from: { type: 'source', arrType: 'all', negate: false, required: false },
							to: { type: 'source', arrType: 'all', negate: false, required: false }
						},
						values: {
							from: { sources: [from] },
							to: { sources: [to] }
						}
					}
				]
			}
		})
	};
}

function upstreamChangeResolutionToSource(
	formatName: string,
	conditionName: string,
	fromResolution: string,
	toSource: string
): SeedOperation {
	return {
		sql: `UPDATE custom_format_conditions
		      SET type = 'source'
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND name = ${sqlValue(conditionName)}
		        AND type = 'resolution'
		        AND arr_type = 'all'
		        AND negate = 1
		        AND required = 0;

		      DELETE FROM condition_resolutions
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND condition_name = ${sqlValue(conditionName)}
		        AND resolution = ${sqlValue(fromResolution)};

		      INSERT INTO condition_sources
		        (custom_format_name, condition_name, source)
		      VALUES (${sqlValue(formatName)}, ${sqlValue(conditionName)}, ${sqlValue(toSource)});`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name: formatName,
			stable_key: { key: 'custom_format_name', value: formatName },
			changed_fields: ['conditions', `condition:${conditionName}`]
		}),
		desiredState: JSON.stringify({
			conditions: {
				updated: [
					{
						name: conditionName,
						base: {
							from: { type: 'resolution', arrType: 'all', negate: true, required: false },
							to: { type: 'source', arrType: 'all', negate: true, required: false }
						},
						values: {
							from: { resolutions: [fromResolution] },
							to: { sources: [toSource] }
						}
					}
				]
			}
		})
	};
}

function upstreamAddResolution(
	formatName: string,
	conditionName: string,
	resolution: string
): SeedOperation {
	return {
		sql: `INSERT INTO custom_format_conditions
		        (custom_format_name, name, type, arr_type, negate, required)
		      VALUES (
		        ${sqlValue(formatName)},
		        ${sqlValue(conditionName)},
		        'resolution',
		        'all',
		        0,
		        0
		      );

		      INSERT INTO condition_resolutions
		        (custom_format_name, condition_name, resolution)
		      VALUES (${sqlValue(formatName)}, ${sqlValue(conditionName)}, ${sqlValue(resolution)});`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name: formatName,
			stable_key: { key: 'custom_format_name', value: formatName },
			changed_fields: ['conditions', `condition:${conditionName}`]
		}),
		desiredState: JSON.stringify({
			conditions: {
				added: [
					{
						name: conditionName,
						base: { type: 'resolution', arrType: 'all', negate: false, required: false },
						values: { resolutions: [resolution] }
					}
				]
			}
		})
	};
}

function upstreamDeleteCondition(formatName: string, conditionName: string): SeedOperation {
	return {
		sql: `DELETE FROM custom_format_conditions
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND name = ${sqlValue(conditionName)}
		        AND type = 'resolution'
		        AND arr_type = 'all'
		        AND negate = 1
		        AND required = 0;`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name: formatName,
			stable_key: { key: 'custom_format_name', value: formatName },
			changed_fields: ['conditions', `condition:${conditionName}`]
		}),
		desiredState: JSON.stringify({
			conditions: {
				removed: [
					{
						name: conditionName,
						base: { type: 'resolution', arrType: 'all', negate: true, required: false },
						values: { resolutions: [ORIGINAL_RESOLUTION] }
					}
				]
			}
		})
	};
}

function multiConditionSeed(): SeedOperation {
	return {
		sql: [
			`INSERT INTO custom_formats (name, description, include_in_rename)
			 VALUES (${sqlValue(FORMAT_NAME)}, '', 0);`,
			sourceConditionSql(FORMAT_NAME, CONDITION_A, CONDITION_A_INITIAL_SOURCE),
			sourceConditionSql(FORMAT_NAME, CONDITION_B, CONDITION_B_INITIAL_SOURCE),
			resolutionConditionSql(FORMAT_NAME, CONDITION_NAME, ORIGINAL_RESOLUTION, true)
		].join('\n')
	};
}

function sourceConditionSql(
	formatName: string,
	conditionName: string,
	source: string,
	negate = false
): string {
	return `INSERT INTO custom_format_conditions
	          (custom_format_name, name, type, arr_type, negate, required)
	        VALUES (
	          ${sqlValue(formatName)},
	          ${sqlValue(conditionName)},
	          'source',
	          'all',
	          ${negate ? 1 : 0},
	          0
	        );

	        INSERT INTO condition_sources
	          (custom_format_name, condition_name, source)
	        VALUES (${sqlValue(formatName)}, ${sqlValue(conditionName)}, ${sqlValue(source)});`;
}

function resolutionConditionSql(
	formatName: string,
	conditionName: string,
	resolution: string,
	negate = false
): string {
	return `INSERT INTO custom_format_conditions
	          (custom_format_name, name, type, arr_type, negate, required)
	        VALUES (
	          ${sqlValue(formatName)},
	          ${sqlValue(conditionName)},
	          'resolution',
	          'all',
	          ${negate ? 1 : 0},
	          0
	        );

	        INSERT INTO condition_resolutions
	          (custom_format_name, condition_name, resolution)
	        VALUES (${sqlValue(formatName)}, ${sqlValue(conditionName)}, ${sqlValue(resolution)});`;
}

function sqlValue(value: string | null): string {
	if (value === null) return 'NULL';
	return `'${value.replace(/'/g, "''")}'`;
}

await run();
