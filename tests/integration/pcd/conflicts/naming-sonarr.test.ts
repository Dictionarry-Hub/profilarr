/**
 * PCD conflict tests: sonarr naming.
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
import { VALID_SONARR_NAMING_DEFAULTS, write } from '../harness/write.ts';
import { multiEpisodeStyleToDb } from '$shared/pcd/mediaManagement.ts';

const PORT = PORTS.pcd.conflictsNamingSonarr;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

type SonarrNamingRow = {
	name: string;
	standard_episode_format: string;
	rename: number;
	replace_illegal_characters: number;
	colon_replacement_format: number;
	multi_episode_style: number;
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
 *   Sonarr naming:
 *     name='Split Conflict', standardEpisodeFormat='{Series Title} - S{season:00}E{episode:00}',
 *     multiEpisodeStyle='extend'
 *
 * User
 *   POST update changes:
 *     standardEpisodeFormat = 'S{season}E{episode}'
 *     multiEpisodeStyle     = 'range'
 *
 * Upstream
 *   Published base op changes:
 *     standard_episode_format '{Series Title} - S{season:00}E{episode:00}' -> '{Series Title} - upstream S{season:00}E{episode:00}'
 *
 * Expect
 *   - standard_episode_format conflicts by strategy
 *   - multi_episode_style applies cleanly for every strategy (exercises the
 *     int-coded splitter path under conflict)
 *   - final multi_episode_style is 'range' (int 4) for every strategy
 *   - final standard_episode_format is the user value only for override
 */
test('split scalar conflicts resolve per field by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'split-scalar', [
			base.sonarrNaming({
				name: 'Split Conflict',
				standardEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat,
				dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
				animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
				seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
				seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat,
				multiEpisodeStyle: 'extend'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.namingSonarr.update(ctx, 'Split Conflict', {
			name: 'Split Conflict',
			rename: true,
			standardEpisodeFormat: 'S{season}E{episode}',
			dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
			animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
			seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
			seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat,
			replaceIllegalCharacters: false,
			colonReplacementFormat: 'delete',
			customColonReplacementFormat: null,
			multiEpisodeStyle: 'range'
		});

		seedUpstream(
			ctx,
			upstreamUpdate('Split Conflict', {
				standard_episode_format: {
					from: VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat,
					to: '{Series Title} - upstream S{season:00}E{episode:00}'
				}
			})
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const standardOp = firstOpForChangedFields(ops, ['standard_episode_format']);
		const multiOp = firstOpForChangedFields(ops, ['multi_episode_style']);

		assertStrategyOutcome(ctx, standardOp, strategy, 'guard_mismatch');
		assertLatestHistory(ctx, multiOp, 'applied');

		const row = assertSonarrNaming(ctx, 'Split Conflict');
		assertEquals(row.multi_episode_style, multiEpisodeStyleToDb('range'));
		assertEquals(
			row.standard_episode_format,
			strategy === 'override'
				? 'S{season}E{episode}'
				: '{Series Title} - upstream S{season:00}E{episode:00}'
		);
	}
});

/**
 * Base
 *   Sonarr naming:
 *     name='Old Naming'
 *
 * User
 *   POST update changes:
 *     name = 'User Naming'
 *
 * Upstream
 *   Published base rename changes:
 *     name 'Old Naming' -> 'Upstream Naming'
 *
 * Expect
 *   - rename op conflicts by strategy
 *   - override final row is named 'User Naming'
 *   - otherwise final row is named 'Upstream Naming'
 */
test('rename conflict follows upstream rename by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'rename', [
			base.sonarrNaming({
				name: 'Old Naming',
				standardEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat,
				dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
				animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
				seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
				seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.namingSonarr.update(ctx, 'Old Naming', {
			name: 'User Naming',
			rename: true,
			standardEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat,
			dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
			animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
			seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
			seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat,
			replaceIllegalCharacters: false,
			colonReplacementFormat: 'delete',
			customColonReplacementFormat: null,
			multiEpisodeStyle: 'extend'
		});

		seedUpstream(ctx, upstreamRename('Old Naming', 'Upstream Naming'));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['name']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		if (strategy === 'override') {
			assertSonarrNaming(ctx, 'User Naming');
			assertNoSonarrNaming(ctx, 'Upstream Naming');
		} else {
			assertSonarrNaming(ctx, 'Upstream Naming');
			assertNoSonarrNaming(ctx, 'User Naming');
		}
	}
});

/**
 * Base
 *   Sonarr naming:
 *     name='Old Naming', standardEpisodeFormat='{Series Title} - S{season:00}E{episode:00}'
 *
 * User
 *   POST update changes:
 *     name                  = 'User Naming'
 *     standardEpisodeFormat = 'S{season}E{episode}'
 *
 * Upstream
 *   Published base rename changes:
 *     name 'Old Naming' -> 'Upstream Naming'
 *
 * Expect
 *   - conflict page field detail follows the upstream rename
 *   - upstream name renders as 'Upstream Naming' instead of missing value
 */
test('conflict page field details follow upstream rename', async () => {
	const ctx = await seededScenario('ask', 'field-detail-upstream-rename', [
		base.sonarrNaming({
			name: 'Old Naming',
			standardEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat,
			dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
			animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
			seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
			seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat
		})
	]);

	await write.namingSonarr.update(ctx, 'Old Naming', {
		name: 'User Naming',
		rename: true,
		standardEpisodeFormat: 'S{season}E{episode}',
		dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
		animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
		seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
		seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat,
		replaceIllegalCharacters: false,
		colonReplacementFormat: 'delete',
		customColonReplacementFormat: null,
		multiEpisodeStyle: 'extend'
	});

	seedUpstream(ctx, upstreamRename('Old Naming', 'Upstream Naming'));
	await compilePcd(ctx);

	const response = await ctx.client.get(`/databases/${ctx.dbId}/conflicts`);
	assertEquals(response.status, 200);
	const body = await response.text();
	assertStringIncludes(body, 'Upstream Naming');
});

/**
 * Base
 *   Empty PCD.
 *
 * User
 *   POST create sonarr naming:
 *     name='Create Conflict', standardEpisodeFormat='S{season}E{episode}',
 *     multiEpisodeStyle='range'
 *
 * Upstream
 *   Published base create:
 *     name='Create Conflict', standardEpisodeFormat='{Series Title} - S{season:00}E{episode:00}',
 *     multiEpisodeStyle='extend'
 *
 * Expect
 *   - create op conflicts by strategy
 *   - final fields are user values only for override
 */
test('create duplicate conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await newScenario(strategy, 'create-duplicate');
		await compilePcd(ctx);
		const checkpoint = opCheckpoint(ctx);

		await write.namingSonarr.create(ctx, {
			name: 'Create Conflict',
			rename: true,
			standardEpisodeFormat: 'S{season}E{episode}',
			dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
			animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
			seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
			seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat,
			replaceIllegalCharacters: false,
			colonReplacementFormat: 'delete',
			customColonReplacementFormat: null,
			multiEpisodeStyle: 'range'
		});

		seedUpstream(
			ctx,
			base.sonarrNaming({
				name: 'Create Conflict',
				standardEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat,
				dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
				animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
				seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
				seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat,
				multiEpisodeStyle: 'extend'
			})
		);
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'create');
		assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');

		const row = assertSonarrNaming(ctx, 'Create Conflict');
		assertEquals(
			row.standard_episode_format,
			strategy === 'override'
				? 'S{season}E{episode}'
				: VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat
		);
		assertEquals(
			row.multi_episode_style,
			strategy === 'override' ? multiEpisodeStyleToDb('range') : multiEpisodeStyleToDb('extend')
		);
	}
});

/**
 * Base
 *   Sonarr naming:
 *     name='Delete Conflict', standardEpisodeFormat='{Series Title}'
 *
 * User
 *   POST delete sonarr naming.
 *
 * Upstream
 *   Published base op changes:
 *     standard_episode_format '{Series Title}' -> '{Series Title} (upstream)'
 *
 * Expect
 *   - delete applies cleanly for every strategy
 *   - final row is absent
 */
test('delete applies cleanly after upstream non-name field change', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-after-field-change', [
			base.sonarrNaming({
				name: 'Delete Conflict',
				standardEpisodeFormat: '{Series Title}'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.namingSonarr.remove(ctx, 'Delete Conflict');

		seedUpstream(
			ctx,
			upstreamUpdate('Delete Conflict', {
				standard_episode_format: {
					from: '{Series Title}',
					to: '{Series Title} (upstream)'
				}
			})
		);
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoSonarrNaming(ctx, 'Delete Conflict');
	}
});

/**
 * Base
 *   Sonarr naming:
 *     name='Already Deleted'
 *
 * User
 *   POST delete sonarr naming.
 *
 * Upstream
 *   Published base delete removes the same row.
 *
 * Expect
 *   - all strategies auto-align/drop the user delete
 *   - final row is absent
 */
test('delete missing target auto-aligns', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-missing-target', [
			base.sonarrNaming({ name: 'Already Deleted' })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.namingSonarr.remove(ctx, 'Already Deleted');

		seedUpstream(ctx, upstreamDelete('Already Deleted'));
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoSonarrNaming(ctx, 'Already Deleted');
	}
});

async function newScenario(strategy: ConflictStrategy, name: string): Promise<PcdTestContext> {
	counter++;
	return setupPcd({
		port: PORT,
		name: `pcd-conflict-naming-sonarr-${counter}-${strategy}-${name}`,
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

function assertSonarrNaming(ctx: PcdTestContext, name: string): SonarrNamingRow {
	const row = compiledSonarrNaming(ctx).find((r) => r.name === name);
	assertExists(row, `Expected sonarr naming ${name}`);
	return row;
}

function assertNoSonarrNaming(ctx: PcdTestContext, name: string): void {
	const row = compiledSonarrNaming(ctx).find((r) => r.name === name);
	assertEquals(row, undefined);
}

function compiledSonarrNaming(ctx: PcdTestContext): SonarrNamingRow[] {
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
				`SELECT name, standard_episode_format, rename, replace_illegal_characters, colon_replacement_format, multi_episode_style
				 FROM sonarr_naming
				 ORDER BY name`
			)
			.all() as SonarrNamingRow[];
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
		sql: `UPDATE sonarr_naming SET ${setSql} WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'sonarr_naming',
			name,
			stable_key: { key: 'sonarr_naming_name', value: name },
			changed_fields: fields
		}),
		desiredState: JSON.stringify(changes)
	};
}

function upstreamRename(from: string, to: string): SeedOperation {
	return {
		sql: `UPDATE sonarr_naming SET name = ${sqlValue(to)} WHERE name = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'sonarr_naming',
			name: to,
			previousName: from,
			stable_key: { key: 'sonarr_naming_name', value: from },
			changed_fields: ['name']
		}),
		desiredState: JSON.stringify({ name: { from, to } })
	};
}

function upstreamDelete(name: string): SeedOperation {
	return {
		sql: `DELETE FROM sonarr_naming WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'delete',
			entity: 'sonarr_naming',
			name,
			stable_key: { key: 'sonarr_naming_name', value: name },
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
