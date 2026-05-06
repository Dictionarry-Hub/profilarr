/**
 * PCD conflict tests: media settings.
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

const PORT = PORTS.pcd.conflictsMediaSettings;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];
const ARR_TYPES = ['radarr', 'sonarr'] as const;

type MediaSettingsArrType = (typeof ARR_TYPES)[number];

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

type MediaSettingsRow = {
	name: string;
	propers_repacks: string;
	enable_media_info: number;
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
 *   Media settings:
 *     name='Split Conflict', propersRepacks='doNotPrefer',
 *     enableMediaInfo=false
 *
 * User
 *   POST update changes:
 *     propersRepacks  = 'preferAndUpgrade'
 *     enableMediaInfo = true
 *
 * Upstream
 *   Published base op changes:
 *     propers_repacks 'doNotPrefer' -> 'doNotUpgradeAutomatically'
 *
 * Expect
 *   - propers_repacks conflicts by strategy
 *   - enable_media_info applies cleanly for every strategy
 *   - final enable_media_info is true for every strategy
 *   - final propers_repacks is user value only for override
 */
test('split scalar conflicts resolve per field by strategy', async () => {
	for (const arrType of ARR_TYPES) {
		for (const strategy of STRATEGIES) {
			const ctx = await seededScenario(strategy, arrType, 'split-scalar', [
				seedFor(arrType, {
					name: 'Split Conflict',
					propersRepacks: 'doNotPrefer',
					enableMediaInfo: false
				})
			]);
			const checkpoint = opCheckpoint(ctx);

			await write.mediaSettings.update(ctx, arrType, 'Split Conflict', {
				name: 'Split Conflict',
				propersRepacks: 'preferAndUpgrade',
				enableMediaInfo: true
			});

			seedUpstream(
				ctx,
				upstreamUpdate(arrType, 'Split Conflict', {
					propers_repacks: {
						from: 'doNotPrefer',
						to: 'doNotUpgradeAutomatically'
					}
				})
			);
			await compilePcd(ctx);

			const ops = opsSince(ctx, checkpoint);
			const propersOp = firstOpForChangedFields(ops, ['propers_repacks']);
			const mediaInfoOp = firstOpForChangedFields(ops, ['enable_media_info']);

			assertStrategyOutcome(ctx, propersOp, strategy, 'guard_mismatch');
			assertLatestHistory(ctx, mediaInfoOp, 'applied');

			const row = assertMediaSettings(ctx, arrType, 'Split Conflict');
			assertEquals(row.enable_media_info, 1);
			assertEquals(
				row.propers_repacks,
				strategy === 'override' ? 'preferAndUpgrade' : 'doNotUpgradeAutomatically'
			);
		}
	}
});

/**
 * Base
 *   Media settings:
 *     name='Old Media'
 *
 * User
 *   POST update changes:
 *     name = 'User Media'
 *
 * Upstream
 *   Published base rename changes:
 *     name 'Old Media' -> 'Upstream Media'
 *
 * Expect
 *   - rename op conflicts by strategy
 *   - override final row is named 'User Media'
 *   - otherwise final row is named 'Upstream Media'
 */
test('rename conflict follows upstream rename by strategy', async () => {
	for (const arrType of ARR_TYPES) {
		for (const strategy of STRATEGIES) {
			const ctx = await seededScenario(strategy, arrType, 'rename', [
				seedFor(arrType, { name: 'Old Media' })
			]);
			const checkpoint = opCheckpoint(ctx);

			await write.mediaSettings.update(ctx, arrType, 'Old Media', {
				name: 'User Media',
				propersRepacks: 'doNotPrefer',
				enableMediaInfo: false
			});

			seedUpstream(ctx, upstreamRename(arrType, 'Old Media', 'Upstream Media'));
			await compilePcd(ctx);

			const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['name']);
			assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

			if (strategy === 'override') {
				assertMediaSettings(ctx, arrType, 'User Media');
				assertNoMediaSettings(ctx, arrType, 'Upstream Media');
			} else {
				assertMediaSettings(ctx, arrType, 'Upstream Media');
				assertNoMediaSettings(ctx, arrType, 'User Media');
			}
		}
	}
});

/**
 * Base
 *   Media settings:
 *     name='Old Media', propersRepacks='doNotPrefer'
 *
 * User
 *   POST update changes:
 *     name            = 'User Media'
 *     propersRepacks  = 'preferAndUpgrade'
 *
 * Upstream
 *   Published base rename changes:
 *     name 'Old Media' -> 'Upstream Media'
 *
 * Expect
 *   - conflict page field detail follows the upstream rename
 *   - upstream name renders as 'Upstream Media' instead of missing value
 */
test('conflict page field details follow upstream rename', async () => {
	for (const arrType of ARR_TYPES) {
		const ctx = await seededScenario('ask', arrType, 'field-detail-upstream-rename', [
			seedFor(arrType, {
				name: 'Old Media',
				propersRepacks: 'doNotPrefer',
				enableMediaInfo: false
			})
		]);

		await write.mediaSettings.update(ctx, arrType, 'Old Media', {
			name: 'User Media',
			propersRepacks: 'preferAndUpgrade',
			enableMediaInfo: false
		});

		seedUpstream(ctx, upstreamRename(arrType, 'Old Media', 'Upstream Media'));
		await compilePcd(ctx);

		const response = await ctx.client.get(`/databases/${ctx.dbId}/conflicts`);
		assertEquals(response.status, 200);
		const body = await response.text();
		assertStringIncludes(body, 'Upstream Media');
	}
});

/**
 * Base
 *   Empty PCD.
 *
 * User
 *   POST create media settings:
 *     name='Create Conflict', propersRepacks='preferAndUpgrade',
 *     enableMediaInfo=true
 *
 * Upstream
 *   Published base create:
 *     name='Create Conflict', propersRepacks='doNotPrefer',
 *     enableMediaInfo=false
 *
 * Expect
 *   - create op conflicts by strategy
 *   - final fields are user values only for override
 */
test('create duplicate conflict resolves by strategy', async () => {
	for (const arrType of ARR_TYPES) {
		for (const strategy of STRATEGIES) {
			const ctx = await newScenario(strategy, arrType, 'create-duplicate');
			await compilePcd(ctx);
			const checkpoint = opCheckpoint(ctx);

			await write.mediaSettings.create(ctx, arrType, {
				name: 'Create Conflict',
				propersRepacks: 'preferAndUpgrade',
				enableMediaInfo: true
			});

			seedUpstream(
				ctx,
				seedFor(arrType, {
					name: 'Create Conflict',
					propersRepacks: 'doNotPrefer',
					enableMediaInfo: false
				})
			);
			await compilePcd(ctx);

			const op = firstOpForOperation(opsSince(ctx, checkpoint), 'create');
			assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');

			const row = assertMediaSettings(ctx, arrType, 'Create Conflict');
			assertEquals(
				row.propers_repacks,
				strategy === 'override' ? 'preferAndUpgrade' : 'doNotPrefer'
			);
			assertEquals(row.enable_media_info, strategy === 'override' ? 1 : 0);
		}
	}
});

/**
 * Base
 *   Media settings:
 *     name='Delete Conflict', propersRepacks='doNotPrefer'
 *
 * User
 *   POST delete media settings.
 *
 * Upstream
 *   Published base op changes:
 *     propers_repacks 'doNotPrefer' -> 'preferAndUpgrade'
 *
 * Expect
 *   - delete applies cleanly for every strategy
 *   - final row is absent
 */
test('delete applies cleanly after upstream non-name field change', async () => {
	for (const arrType of ARR_TYPES) {
		for (const strategy of STRATEGIES) {
			const ctx = await seededScenario(strategy, arrType, 'delete-after-field-change', [
				seedFor(arrType, {
					name: 'Delete Conflict',
					propersRepacks: 'doNotPrefer',
					enableMediaInfo: false
				})
			]);
			const checkpoint = opCheckpoint(ctx);

			await write.mediaSettings.remove(ctx, arrType, 'Delete Conflict');

			seedUpstream(
				ctx,
				upstreamUpdate(arrType, 'Delete Conflict', {
					propers_repacks: { from: 'doNotPrefer', to: 'preferAndUpgrade' }
				})
			);
			await compilePcd(ctx);

			const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
			assertEquals(op.state, 'published');
			assertLatestHistory(ctx, op, 'applied');
			assertNoMediaSettings(ctx, arrType, 'Delete Conflict');
		}
	}
});

/**
 * Base
 *   Media settings:
 *     name='Already Deleted'
 *
 * User
 *   POST delete media settings.
 *
 * Upstream
 *   Published base delete removes the same row.
 *
 * Expect
 *   - all strategies auto-align/drop the user delete
 *   - final row is absent
 */
test('delete missing target auto-aligns', async () => {
	for (const arrType of ARR_TYPES) {
		for (const strategy of STRATEGIES) {
			const ctx = await seededScenario(strategy, arrType, 'delete-missing-target', [
				seedFor(arrType, { name: 'Already Deleted' })
			]);
			const checkpoint = opCheckpoint(ctx);

			await write.mediaSettings.remove(ctx, arrType, 'Already Deleted');

			seedUpstream(ctx, upstreamDelete(arrType, 'Already Deleted'));
			await compilePcd(ctx);

			const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
			assertEquals(op.state, 'dropped');
			assertLatestHistory(ctx, op, 'dropped', 'aligned');
			assertNoMediaSettings(ctx, arrType, 'Already Deleted');
		}
	}
});

async function newScenario(
	strategy: ConflictStrategy,
	arrType: MediaSettingsArrType,
	name: string
): Promise<PcdTestContext> {
	counter++;
	return setupPcd({
		port: PORT,
		name: `pcd-conflict-media-settings-${counter}-${arrType}-${strategy}-${name}`,
		conflictStrategy: strategy
	});
}

async function seededScenario(
	strategy: ConflictStrategy,
	arrType: MediaSettingsArrType,
	name: string,
	operations: Array<string | SeedOperation>
): Promise<PcdTestContext> {
	const ctx = await newScenario(strategy, arrType, name);
	seedBase(ctx, operations);
	await compilePcd(ctx);
	return ctx;
}

function seedFor(
	arrType: MediaSettingsArrType,
	input: Parameters<typeof base.radarrMediaSettings>[0]
): SeedOperation {
	return arrType === 'radarr' ? base.radarrMediaSettings(input) : base.sonarrMediaSettings(input);
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

function assertMediaSettings(
	ctx: PcdTestContext,
	arrType: MediaSettingsArrType,
	name: string
): MediaSettingsRow {
	const row = compiledMediaSettings(ctx, arrType).find((settings) => settings.name === name);
	assertExists(row, `Expected ${arrType} media settings ${name}`);
	return row;
}

function assertNoMediaSettings(
	ctx: PcdTestContext,
	arrType: MediaSettingsArrType,
	name: string
): void {
	const row = compiledMediaSettings(ctx, arrType).find((settings) => settings.name === name);
	assertEquals(row, undefined);
}

function compiledMediaSettings(
	ctx: PcdTestContext,
	arrType: MediaSettingsArrType
): MediaSettingsRow[] {
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
				`SELECT name, propers_repacks, enable_media_info
				 FROM ${tableForArrType(arrType)}
				 ORDER BY name`
			)
			.all() as MediaSettingsRow[];
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
	arrType: MediaSettingsArrType,
	name: string,
	changes: Record<string, { from: unknown; to: unknown }>
): SeedOperation {
	const fields = Object.keys(changes);
	const setSql = fields.map((field) => `${field} = ${sqlValue(changes[field].to)}`).join(', ');
	return {
		sql: `UPDATE ${tableForArrType(arrType)} SET ${setSql} WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: entityForArrType(arrType),
			name,
			stable_key: { key: stableKeyForArrType(arrType), value: name },
			changed_fields: fields
		}),
		desiredState: JSON.stringify(changes)
	};
}

function upstreamRename(arrType: MediaSettingsArrType, from: string, to: string): SeedOperation {
	return {
		sql: `UPDATE ${tableForArrType(arrType)} SET name = ${sqlValue(to)} WHERE name = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: entityForArrType(arrType),
			name: to,
			previousName: from,
			stable_key: { key: stableKeyForArrType(arrType), value: from },
			changed_fields: ['name']
		}),
		desiredState: JSON.stringify({ name: { from, to } })
	};
}

function upstreamDelete(arrType: MediaSettingsArrType, name: string): SeedOperation {
	return {
		sql: `DELETE FROM ${tableForArrType(arrType)} WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'delete',
			entity: entityForArrType(arrType),
			name,
			stable_key: { key: stableKeyForArrType(arrType), value: name },
			changed_fields: ['deleted']
		}),
		desiredState: JSON.stringify({ deleted: true, name })
	};
}

function tableForArrType(arrType: MediaSettingsArrType): string {
	return arrType === 'radarr' ? 'radarr_media_settings' : 'sonarr_media_settings';
}

function entityForArrType(arrType: MediaSettingsArrType): string {
	return tableForArrType(arrType);
}

function stableKeyForArrType(arrType: MediaSettingsArrType): string {
	return `${tableForArrType(arrType)}_name`;
}

function sqlValue(value: unknown): string {
	if (value === null || value === undefined) return 'NULL';
	if (typeof value === 'number') return String(value);
	if (typeof value === 'boolean') return value ? '1' : '0';
	return `'${String(value).replace(/'/g, "''")}'`;
}

await run();
