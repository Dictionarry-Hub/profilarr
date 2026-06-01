/**
 * PCD write tests: quality profile qualities update.
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
	parseMetadata,
	type OpRow,
	type PcdTestContext
} from '../../harness/pcd.ts';
import { write, type QualityProfileQualityItemInput } from '../../harness/write.ts';
import { createScenarioFactory, userOpsSince } from './helpers.ts';

const PORT = PORTS.pcd.writeQualityProfilesQualitiesUpdate;
const ORIGIN = `http://localhost:${PORT}`;
const PROFILE_NAME = 'Qualities Profile';
const QUALITY_A = 'Quality A';
const QUALITY_B = 'Quality B';
const QUALITY_C = 'Quality C';
const GROUP_NAME = '2160p';

type QualityItemRow = {
	type: 'quality' | 'group';
	name: string;
	position: number;
	enabled: number;
	upgrade_until: number;
};

type QualityGroupMemberRow = {
	quality_group_name: string;
	quality_name: string;
	position: number;
};

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-quality-profile-qualities-update');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Base layer seeded with one quality profile via base.qualityProfile():
 *     Quality A position=0 enabled=true  upgradeUntil=false
 *     Quality B position=1 enabled=true  upgradeUntil=true
 *     Quality C position=2 enabled=false upgradeUntil=false
 *   Compiled.
 *
 * Submit
 *   POST /quality-profiles/{ctx.dbId}/1/qualities?/update with form fields:
 *     orderedItems = [
 *       Quality C position=0 enabled=false upgradeUntil=false,
 *       Quality A position=1 enabled=true  upgradeUntil=false,
 *       Quality B position=2 enabled=true  upgradeUntil=true
 *     ]
 *     layer = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.changed_fields contains one field for each moved row
 *   - op.desired_state.ordered_items has full-list from/to arrays
 *   - replayed compiled order is Quality C, Quality A, Quality B
 */
test('reorder existing qualities emits one batched op', async () => {
	const ctx = await seededPcd('reorder-existing-qualities', [
		base.qualityProfile({
			name: PROFILE_NAME,
			qualityItems: [
				qualityItem(QUALITY_A, 0),
				qualityItem(QUALITY_B, 1, { upgradeUntil: true }),
				qualityItem(QUALITY_C, 2, { enabled: false })
			]
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityProfile.updateQualities(ctx, 1, {
		orderedItems: [
			qualityItem(QUALITY_C, 0, { enabled: false }),
			qualityItem(QUALITY_A, 1),
			qualityItem(QUALITY_B, 2, { upgradeUntil: true })
		]
	});

	const op = singleQualitiesOp(ctx, checkpoint);
	assertChangedFields(op, [
		'quality_item:quality:Quality A',
		'quality_item:quality:Quality B',
		'quality_item:quality:Quality C'
	]);
	assertFullListDesiredState(op, 3, 3);
	assertEquals(compiledQualityOrder(ctx), [QUALITY_C, QUALITY_A, QUALITY_B]);
});

/**
 * Context
 *   Base layer seeded with one quality profile via base.qualityProfile():
 *     Quality A position=0 enabled=true upgradeUntil=true
 *     Quality B position=1 enabled=true upgradeUntil=false
 *     Quality C position=2 enabled=true upgradeUntil=false
 *   Compiled.
 *
 * Submit
 *   POST /quality-profiles/{ctx.dbId}/1/qualities?/update with form fields:
 *     orderedItems = [
 *       Quality A position=0 enabled=true upgradeUntil=true,
 *       group 2160p position=1 enabled=true upgradeUntil=false members=[Quality B, Quality C]
 *     ]
 *     layer = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.changed_fields contains removed quality rows and added group row
 *   - op.sql inserts quality_groups, quality_group_members, and quality_profile_qualities
 *   - replayed compiled order is Quality A, 2160p
 *   - replayed group members are Quality B, Quality C
 */
test('create group emits one batched op with group members and row', async () => {
	const ctx = await seededPcd('create-group', [
		base.qualityProfile({
			name: PROFILE_NAME,
			qualityItems: [
				qualityItem(QUALITY_A, 0, { upgradeUntil: true }),
				qualityItem(QUALITY_B, 1),
				qualityItem(QUALITY_C, 2)
			]
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityProfile.updateQualities(ctx, 1, {
		orderedItems: [
			qualityItem(QUALITY_A, 0, { upgradeUntil: true }),
			groupItem(GROUP_NAME, 1, [QUALITY_B, QUALITY_C])
		]
	});

	const op = singleQualitiesOp(ctx, checkpoint);
	assertChangedFields(op, [
		'quality_item:quality:Quality B',
		'quality_item:quality:Quality C',
		'quality_item:group:2160p'
	]);
	const sql = normalizeSql(op.sql).toLowerCase();
	assert(sql.includes('insert into quality_groups'), `Expected quality_groups insert, got ${sql}`);
	assert(
		sql.includes('insert into quality_group_members'),
		`Expected quality_group_members insert, got ${sql}`
	);
	assert(
		sql.includes('insert into quality_profile_qualities'),
		`Expected quality_profile_qualities insert, got ${sql}`
	);
	assertEquals(compiledQualityOrder(ctx), [QUALITY_A, GROUP_NAME]);
	assertEquals(compiledGroupMembers(ctx, GROUP_NAME), [QUALITY_B, QUALITY_C]);
	assertEquals(compiledUpgradeUntilName(ctx), QUALITY_A);
});

/**
 * Context
 *   Base layer seeded with one quality profile via base.qualityProfile():
 *     Quality A position=0 enabled=true upgradeUntil=true
 *     Quality B position=1 enabled=true upgradeUntil=false
 *   Compiled.
 *
 * Submit
 *   POST /quality-profiles/{ctx.dbId}/1/qualities?/update with form fields:
 *     orderedItems = [
 *       Quality A position=0 enabled=true upgradeUntil=false,
 *       Quality B position=1 enabled=true upgradeUntil=true
 *     ]
 *     layer = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.sql clears Quality A upgrade_until before setting Quality B upgrade_until
 *   - replayed compiled upgrade-until item is Quality B
 */
test('move upgrade until between existing rows clears before setting', async () => {
	const ctx = await seededPcd('move-upgrade-until-existing', [
		base.qualityProfile({
			name: PROFILE_NAME,
			qualityItems: [qualityItem(QUALITY_A, 0, { upgradeUntil: true }), qualityItem(QUALITY_B, 1)]
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityProfile.updateQualities(ctx, 1, {
		orderedItems: [qualityItem(QUALITY_A, 0), qualityItem(QUALITY_B, 1, { upgradeUntil: true })]
	});

	const op = singleQualitiesOp(ctx, checkpoint);
	assertSqlOrder(
		op.sql,
		"set upgrade_until = 0 where quality_profile_name = 'qualities profile' and quality_name = 'quality a'",
		"set upgrade_until = 1 where quality_profile_name = 'qualities profile' and quality_name = 'quality b'"
	);
	assertEquals(compiledUpgradeUntilName(ctx), QUALITY_B);
});

/**
 * Context
 *   Base layer seeded with one quality profile via base.qualityProfile():
 *     Quality A position=0 enabled=true upgradeUntil=true
 *     Quality B position=1 enabled=true upgradeUntil=false
 *     Quality C position=2 enabled=true upgradeUntil=false
 *   Compiled.
 *
 * Submit
 *   POST /quality-profiles/{ctx.dbId}/1/qualities?/update with form fields:
 *     orderedItems = [
 *       Quality A position=0 enabled=true upgradeUntil=false,
 *       group 2160p position=1 enabled=true upgradeUntil=true members=[Quality B, Quality C]
 *     ]
 *     layer = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.sql clears Quality A upgrade_until before inserting 2160p with upgrade_until=1
 *   - replayed compiled upgrade-until item is 2160p
 *   - replayed group members are Quality B, Quality C
 */
test('create group and mark it upgrade until clears old marker before adding group row', async () => {
	const ctx = await seededPcd('create-group-upgrade-until', [
		base.qualityProfile({
			name: PROFILE_NAME,
			qualityItems: [
				qualityItem(QUALITY_A, 0, { upgradeUntil: true }),
				qualityItem(QUALITY_B, 1),
				qualityItem(QUALITY_C, 2)
			]
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityProfile.updateQualities(ctx, 1, {
		orderedItems: [
			qualityItem(QUALITY_A, 0),
			groupItem(GROUP_NAME, 1, [QUALITY_B, QUALITY_C], { upgradeUntil: true })
		]
	});

	const op = singleQualitiesOp(ctx, checkpoint);
	assertSqlOrder(
		op.sql,
		"set upgrade_until = 0 where quality_profile_name = 'qualities profile' and quality_name = 'quality a'",
		"select 'qualities profile', null, '2160p', 1, 1, 1"
	);
	assertEquals(compiledUpgradeUntilName(ctx), GROUP_NAME);
	assertEquals(compiledGroupMembers(ctx, GROUP_NAME), [QUALITY_B, QUALITY_C]);
});

function qualityItem(
	name: string,
	position: number,
	options: Partial<Pick<QualityProfileQualityItemInput, 'enabled' | 'upgradeUntil'>> = {}
): QualityProfileQualityItemInput {
	return {
		type: 'quality',
		name,
		position,
		enabled: options.enabled ?? true,
		upgradeUntil: options.upgradeUntil ?? false
	};
}

function groupItem(
	name: string,
	position: number,
	members: string[],
	options: Partial<Pick<QualityProfileQualityItemInput, 'enabled' | 'upgradeUntil'>> = {}
): QualityProfileQualityItemInput {
	return {
		type: 'group',
		name,
		position,
		enabled: options.enabled ?? true,
		upgradeUntil: options.upgradeUntil ?? false,
		members: members.map((member) => ({ name: member }))
	};
}

function singleQualitiesOp(ctx: PcdTestContext, checkpoint: number): OpRow {
	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = ops[0];
	assertEquals(parseMetadata(op).operation, 'update');
	assertEquals(parseMetadata(op).entity, 'quality_profile');
	assertEquals(parseMetadata(op).name, PROFILE_NAME);
	return op;
}

function assertChangedFields(op: OpRow, expected: string[]): void {
	const metadata = parseMetadata(op);
	const fields = metadata.changed_fields;
	assert(Array.isArray(fields), 'Expected changed_fields array');
	assertEquals([...fields].sort(), [...expected].sort());
}

function assertFullListDesiredState(op: OpRow, fromLength: number, toLength: number): void {
	const desired = parseDesiredState(op);
	const orderedItems = desired.ordered_items as { from?: unknown; to?: unknown } | undefined;
	assertExists(orderedItems, 'Expected ordered_items desired state');
	assert(Array.isArray(orderedItems.from), 'Expected ordered_items.from array');
	assert(Array.isArray(orderedItems.to), 'Expected ordered_items.to array');
	assertEquals(orderedItems.from.length, fromLength);
	assertEquals(orderedItems.to.length, toLength);
}

function assertSqlOrder(sql: string, before: string, after: string): void {
	const normalized = normalizeSql(sql).toLowerCase();
	const beforeIndex = normalized.indexOf(before);
	const afterIndex = normalized.indexOf(after);
	assert(beforeIndex >= 0, `Expected SQL to contain ${before}, got ${normalized}`);
	assert(afterIndex >= 0, `Expected SQL to contain ${after}, got ${normalized}`);
	assert(beforeIndex < afterIndex, `Expected ${before} before ${after}, got ${normalized}`);
}

function compiledQualityOrder(ctx: PcdTestContext): string[] {
	return compiledQualityState(ctx)
		.qualityItems.sort((a, b) => a.position - b.position)
		.map((item) => item.name);
}

function compiledUpgradeUntilName(ctx: PcdTestContext): string | null {
	return (
		compiledQualityState(ctx).qualityItems.find((item) => item.upgrade_until === 1)?.name ?? null
	);
}

function compiledGroupMembers(ctx: PcdTestContext, groupName: string): string[] {
	return compiledQualityState(ctx)
		.groupMembers.filter((member) => member.quality_group_name === groupName)
		.sort((a, b) => a.position - b.position)
		.map((member) => member.quality_name);
}

function compiledQualityState(ctx: PcdTestContext): {
	qualityItems: QualityItemRow[];
	groupMembers: QualityGroupMemberRow[];
} {
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

		const qualityItems = replay
			.prepare(
				`SELECT CASE
				          WHEN quality_group_name IS NULL THEN 'quality'
				          ELSE 'group'
				        END AS type,
				        COALESCE(quality_name, quality_group_name) AS name,
				        position,
				        enabled,
				        upgrade_until
				 FROM quality_profile_qualities
				 WHERE quality_profile_name = ?
				 ORDER BY position, name`
			)
			.all(PROFILE_NAME) as QualityItemRow[];
		const groupMembers = replay
			.prepare(
				`SELECT quality_group_name,
				        quality_name,
				        position
				 FROM quality_group_members
				 WHERE quality_profile_name = ?
				 ORDER BY quality_group_name, position, quality_name`
			)
			.all(PROFILE_NAME) as QualityGroupMemberRow[];

		return { qualityItems, groupMembers };
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
