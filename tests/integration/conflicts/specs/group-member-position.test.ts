/**
 * Integration tests: Quality group member position ordering
 *
 * Tests that quality_group_members.position is correctly handled during
 * compile: position values are preserved, old ops without position still
 * compile (DEFAULT 0), and conflicts are detected when upstream reorders
 * members that the user has also reordered.
 */

import { assertEquals, assertExists } from '@std/assert';
import { TestClient } from '../../auth/harness/client.ts';
import { getDbPath, startServer, stopServer } from '../../auth/harness/server.ts';
import { run, setup, teardown, test } from '../../auth/harness/runner.ts';
import {
	createDatabaseInstance,
	createPcdRepo,
	insertOp,
	queryLatestConflicts,
	queryLatestHistory
} from '../harness/setup.ts';
import { Database } from 'jsr:@db/sqlite@0.12';

const PORT = 7026;
const ORIGIN = `http://localhost:${PORT}`;

let client: TestClient;

// ─── Scenario 1: Basic position ordering ────────────────────────────────────

let basicDbId: number;

// ─── Scenario 2: Backwards compatibility (no position in ops) ───────────────

let compatDbId: number;

// ─── Scenario 3: Conflict — upstream + user both reorder (ask) ──────────────

let askDbId: number;
let askUserOpId: number;

// ─── Scenario 4: Conflict — upstream + user both reorder (align) ────────────

let alignDbId: number;
let alignUserOpId: number;

// ─── Scenario 5: Add member to existing group ───────────────────────────────

let addDbId: number;
let addUserOpId: number;

// ─── Scenario 6: Remove member from existing group ──────────────────────────

let removeDbId: number;
let removeUserOpId: number;

// ─── Helpers ────────────────────────────────────────────────────────────────

function esc(str: string): string {
	return str.replace(/'/g, "''");
}

function buildGroupMembersGuard(profileName: string, groupName: string, members: string[]): string {
	const baseWhere = `quality_profile_name = '${esc(profileName)}'
  AND quality_group_name = '${esc(groupName)}'`;

	if (members.length === 0) {
		return `(SELECT COUNT(*)
FROM quality_group_members
WHERE ${baseWhere}) = 0`;
	}

	const expectedMembers = members.map((member) => `'${esc(member)}'`).join(', ');
	const positionChecks = members.map(
		(member, index) =>
			`(quality_name = '${esc(member)}'
        AND position = ${index})`
	).join(`
      OR `);

	return `(SELECT COUNT(*)
FROM quality_group_members
WHERE ${baseWhere}) = ${members.length}
  AND NOT EXISTS (
    SELECT 1
    FROM quality_group_members
    WHERE ${baseWhere}
      AND quality_name NOT IN (${expectedMembers})
  )
  AND (
    NOT EXISTS (
      SELECT 1
      FROM quality_group_members
      WHERE ${baseWhere}
        AND NOT (
          ${positionChecks}
        )
    )
    OR NOT EXISTS (
      SELECT 1
      FROM quality_group_members
      WHERE ${baseWhere}
        AND position != 0
    )
  )`;
}

function buildGuardedGroupRewriteSql(
	profileName: string,
	groupName: string,
	currentMembers: string[],
	nextMembers: string[]
): string {
	const guard = buildGroupMembersGuard(profileName, groupName, currentMembers);
	const statements = [
		`DELETE FROM quality_group_members
WHERE quality_profile_name = '${esc(profileName)}'
  AND quality_group_name = '${esc(groupName)}'
  AND ${guard};`
	];

	if (nextMembers.length > 0) {
		const insertRows = nextMembers
			.map(
				(member, index) =>
					`SELECT '${esc(profileName)}' AS quality_profile_name, '${esc(
						groupName
					)}' AS quality_group_name, '${esc(member)}' AS quality_name, ${index} AS position`
			)
			.join('\nUNION ALL\n');

		statements.push(
			`INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position)
WITH can_insert AS (
  SELECT (
    SELECT COUNT(*)
    FROM quality_group_members
    WHERE quality_profile_name = '${esc(profileName)}'
      AND quality_group_name = '${esc(groupName)}'
  ) = 0 AS ok
),
new_rows AS (
${insertRows}
)
SELECT
  new_rows.quality_profile_name,
  new_rows.quality_group_name,
  new_rows.quality_name,
  new_rows.position
FROM new_rows
CROSS JOIN can_insert
WHERE ok;`
		);
	}

	return statements.join('\n');
}

let pcdModulesPromise: Promise<{
	compile: (pcdPath: string, databaseInstanceId: number) => Promise<unknown>;
	getCache: (databaseInstanceId: number) =>
		| {
				query<T = unknown>(
					sql: string,
					...params: (string | number | null | boolean | Uint8Array)[]
				): T[];
		  }
		| undefined;
	databaseInstancesQueries: {
		getById(id: number): { id: number; local_path: string } | undefined;
	};
	config: { init(): Promise<void> };
	db: { initialize(): Promise<void> };
}> | null = null;

async function loadPcdModules() {
	if (!pcdModulesPromise) {
		Deno.env.set('APP_BASE_PATH', `./dist/integration-${PORT}`);
		Deno.env.set('AUTH', 'off');
		pcdModulesPromise = Promise.all([
			import('../../../../src/lib/server/pcd/index.ts'),
			import('../../../../src/lib/server/db/queries/databaseInstances.ts'),
			import('../../../../src/lib/server/utils/config/config.ts'),
			import('../../../../src/lib/server/db/db.ts')
		]).then(([pcd, dbQueries, configMod, dbMod]) => ({
			compile: pcd.compile,
			getCache: pcd.getCache,
			databaseInstancesQueries: dbQueries.databaseInstancesQueries,
			config: configMod.config,
			db: dbMod.db
		}));
	}
	return pcdModulesPromise;
}

async function queryCompiledGroupMembers(
	databaseId: number,
	profileName: string,
	groupName: string
): Promise<Array<{ quality_name: string; position: number }>> {
	const { compile, getCache, databaseInstancesQueries, config, db } = await loadPcdModules();
	await config.init();
	await db.initialize();
	const instance = databaseInstancesQueries.getById(databaseId);
	if (!instance) throw new Error(`Database instance ${databaseId} not found`);
	await compile(instance.local_path, instance.id);
	const cache = getCache(databaseId);
	if (!cache) throw new Error(`Cache not found for database ${databaseId}`);
	return cache.query<{ quality_name: string; position: number }>(
		`SELECT quality_name, position
FROM quality_group_members
WHERE quality_profile_name = ?
  AND quality_group_name = ?
ORDER BY position, quality_name`,
		profileName,
		groupName
	);
}

/**
 * Seed a quality profile with a group containing members at explicit positions.
 * Returns the draft trigger op id for compile.
 */
function seedProfileWithGroup(
	dbPath: string,
	dbId: number,
	opts: {
		profileName: string;
		groupName: string;
		members: string[]; // in position order
		includePosition: boolean;
	}
): number {
	// Create qualities
	opts.members.forEach((name, index) => {
		insertOp(dbPath, {
			databaseId: dbId,
			origin: 'base',
			state: 'published',
			sql: `INSERT INTO qualities (name) SELECT '${name}' WHERE NOT EXISTS (SELECT 1 FROM qualities WHERE name = '${name}');`,
			sequence: 10 + index
		});
	});

	// Create quality profile
	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_profiles (name, description) VALUES ('${opts.profileName}', 'Test profile');`,
		sequence: 100
	});

	// Create quality group
	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_groups (quality_profile_name, name) VALUES ('${opts.profileName}', '${opts.groupName}');`,
		sequence: 110
	});

	// Insert group members with or without position
	opts.members.forEach((member, index) => {
		const sql = opts.includePosition
			? `INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('${opts.profileName}', '${opts.groupName}', '${member}', ${index});`
			: `INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name) VALUES ('${opts.profileName}', '${opts.groupName}', '${member}');`;

		insertOp(dbPath, {
			databaseId: dbId,
			origin: 'base',
			state: 'published',
			sql,
			sequence: 120 + index
		});
	});

	// Insert quality_profile_qualities entry for the group
	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_profile_qualities (quality_profile_name, quality_group_name, quality_name, position, enabled, upgrade_until) VALUES ('${opts.profileName}', '${opts.groupName}', NULL, 0, 1, 0);`,
		sequence: 200
	});

	// Draft trigger
	return insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'draft',
		sql: 'SELECT 1;',
		sequence: 0
	});
}

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN });
	client = new TestClient(ORIGIN);

	const basePath = `./dist/integration-${PORT}`;
	const dbPath = getDbPath(PORT);

	// ─── Scenario 1: Basic position ordering ────────────────────────────────
	const basicPath = await createPcdRepo(basePath, 'group-pos-basic');
	basicDbId = createDatabaseInstance(dbPath, {
		name: 'group-pos-basic',
		uuid: 'group-pos-basic',
		localPath: basicPath,
		conflictStrategy: 'ask'
	});
	const basicDraftId = seedProfileWithGroup(dbPath, basicDbId, {
		profileName: 'Test Profile',
		groupName: 'HD Group',
		members: ['HDTV-1080p', 'WEBRip-1080p', 'Bluray-1080p'],
		includePosition: true
	});
	await client.postForm(
		`/databases/${basicDbId}/changes?/drop`,
		{ opIds: String(basicDraftId) },
		{ headers: { Origin: ORIGIN } }
	);

	// ─── Scenario 2: Backwards compatibility ────────────────────────────────
	const compatPath = await createPcdRepo(basePath, 'group-pos-compat');
	compatDbId = createDatabaseInstance(dbPath, {
		name: 'group-pos-compat',
		uuid: 'group-pos-compat',
		localPath: compatPath,
		conflictStrategy: 'ask'
	});
	const compatDraftId = seedProfileWithGroup(dbPath, compatDbId, {
		profileName: 'Compat Profile',
		groupName: 'SD Group',
		members: ['DVD', 'SDTV', 'WEBDL-480p'],
		includePosition: false // old-style ops without position
	});
	await client.postForm(
		`/databases/${compatDbId}/changes?/drop`,
		{ opIds: String(compatDraftId) },
		{ headers: { Origin: ORIGIN } }
	);

	// ─── Scenario 3: Conflict — ask strategy ────────────────────────────────
	const askPath = await createPcdRepo(basePath, 'group-pos-ask');
	askDbId = createDatabaseInstance(dbPath, {
		name: 'group-pos-ask',
		uuid: 'group-pos-ask',
		localPath: askPath,
		conflictStrategy: 'ask'
	});

	// Base: create profile with members in order A, B, C
	const askBaseMembers = ['HDTV-720p', 'WEBRip-720p', 'Bluray-720p'];
	askBaseMembers.forEach((name, index) => {
		insertOp(dbPath, {
			databaseId: askDbId,
			origin: 'base',
			state: 'published',
			sql: `INSERT INTO qualities (name) SELECT '${name}' WHERE NOT EXISTS (SELECT 1 FROM qualities WHERE name = '${name}');`,
			sequence: 10 + index
		});
	});
	insertOp(dbPath, {
		databaseId: askDbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_profiles (name, description) VALUES ('Conflict Profile', 'Test');`,
		sequence: 100
	});
	insertOp(dbPath, {
		databaseId: askDbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_groups (quality_profile_name, name) VALUES ('Conflict Profile', 'Conflict Group');`,
		sequence: 110
	});
	askBaseMembers.forEach((member, index) => {
		insertOp(dbPath, {
			databaseId: askDbId,
			origin: 'base',
			state: 'published',
			sql: `INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Conflict Profile', 'Conflict Group', '${member}', ${index});`,
			sequence: 120 + index
		});
	});
	insertOp(dbPath, {
		databaseId: askDbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_profile_qualities (quality_profile_name, quality_group_name, quality_name, position, enabled, upgrade_until) VALUES ('Conflict Profile', 'Conflict Group', NULL, 0, 1, 0);`,
		sequence: 200
	});

	// Base op #2: upstream reorders members to C, B, A (delete all + re-insert)
	askBaseMembers.forEach((member, index) => {
		insertOp(dbPath, {
			databaseId: askDbId,
			origin: 'base',
			state: 'published',
			sql: `DELETE FROM quality_group_members WHERE quality_profile_name = 'Conflict Profile' AND quality_group_name = 'Conflict Group' AND quality_name = '${member}';`,
			sequence: 300 + index
		});
	});
	const reorderedAsk = ['Bluray-720p', 'WEBRip-720p', 'HDTV-720p'];
	reorderedAsk.forEach((member, index) => {
		insertOp(dbPath, {
			databaseId: askDbId,
			origin: 'base',
			state: 'published',
			sql: `INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Conflict Profile', 'Conflict Group', '${member}', ${index});`,
			sequence: 310 + index
		});
	});

	// User op: reorders to B, A, C (guards expect original order A=0, B=1, C=2)
	const userReorder = ['WEBRip-720p', 'HDTV-720p', 'Bluray-720p'];
	const userRewriteSql = buildGuardedGroupRewriteSql(
		'Conflict Profile',
		'Conflict Group',
		askBaseMembers,
		userReorder
	);

	askUserOpId = insertOp(dbPath, {
		databaseId: askDbId,
		origin: 'user',
		state: 'published',
		sql: userRewriteSql,
		sequence: 100,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name: 'Conflict Profile',
			stable_key: { key: 'quality_profile_name', value: 'Conflict Profile' },
			changed_fields: ['quality_item:group:Conflict Group']
		}),
		desiredState: JSON.stringify({
			ordered_items: {
				from: [
					{
						type: 'group',
						name: 'Conflict Group',
						position: 0,
						enabled: true,
						upgradeUntil: false,
						members: [{ name: 'HDTV-720p' }, { name: 'WEBRip-720p' }, { name: 'Bluray-720p' }]
					}
				],
				to: [
					{
						type: 'group',
						name: 'Conflict Group',
						position: 0,
						enabled: true,
						upgradeUntil: false,
						members: [{ name: 'WEBRip-720p' }, { name: 'HDTV-720p' }, { name: 'Bluray-720p' }]
					}
				]
			}
		})
	});

	const askDraftId = insertOp(dbPath, {
		databaseId: askDbId,
		origin: 'base',
		state: 'draft',
		sql: 'SELECT 1;',
		sequence: 0
	});
	await client.postForm(
		`/databases/${askDbId}/changes?/drop`,
		{ opIds: String(askDraftId) },
		{ headers: { Origin: ORIGIN } }
	);

	// ─── Scenario 4: Conflict — align strategy ──────────────────────────────
	const alignPath = await createPcdRepo(basePath, 'group-pos-align');
	alignDbId = createDatabaseInstance(dbPath, {
		name: 'group-pos-align',
		uuid: 'group-pos-align',
		localPath: alignPath,
		conflictStrategy: 'align'
	});

	// Same seed as ask scenario
	askBaseMembers.forEach((name, index) => {
		insertOp(dbPath, {
			databaseId: alignDbId,
			origin: 'base',
			state: 'published',
			sql: `INSERT INTO qualities (name) SELECT '${name}' WHERE NOT EXISTS (SELECT 1 FROM qualities WHERE name = '${name}');`,
			sequence: 10 + index
		});
	});
	insertOp(dbPath, {
		databaseId: alignDbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_profiles (name, description) VALUES ('Conflict Profile', 'Test');`,
		sequence: 100
	});
	insertOp(dbPath, {
		databaseId: alignDbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_groups (quality_profile_name, name) VALUES ('Conflict Profile', 'Conflict Group');`,
		sequence: 110
	});
	askBaseMembers.forEach((member, index) => {
		insertOp(dbPath, {
			databaseId: alignDbId,
			origin: 'base',
			state: 'published',
			sql: `INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Conflict Profile', 'Conflict Group', '${member}', ${index});`,
			sequence: 120 + index
		});
	});
	insertOp(dbPath, {
		databaseId: alignDbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_profile_qualities (quality_profile_name, quality_group_name, quality_name, position, enabled, upgrade_until) VALUES ('Conflict Profile', 'Conflict Group', NULL, 0, 1, 0);`,
		sequence: 200
	});

	// Upstream reorder
	askBaseMembers.forEach((member, index) => {
		insertOp(dbPath, {
			databaseId: alignDbId,
			origin: 'base',
			state: 'published',
			sql: `DELETE FROM quality_group_members WHERE quality_profile_name = 'Conflict Profile' AND quality_group_name = 'Conflict Group' AND quality_name = '${member}';`,
			sequence: 300 + index
		});
	});
	reorderedAsk.forEach((member, index) => {
		insertOp(dbPath, {
			databaseId: alignDbId,
			origin: 'base',
			state: 'published',
			sql: `INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Conflict Profile', 'Conflict Group', '${member}', ${index});`,
			sequence: 310 + index
		});
	});

	// User op (same as ask)
	alignUserOpId = insertOp(dbPath, {
		databaseId: alignDbId,
		origin: 'user',
		state: 'published',
		sql: userRewriteSql,
		sequence: 100,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name: 'Conflict Profile',
			stable_key: { key: 'quality_profile_name', value: 'Conflict Profile' },
			changed_fields: ['quality_item:group:Conflict Group']
		}),
		desiredState: JSON.stringify({
			ordered_items: {
				from: [
					{
						type: 'group',
						name: 'Conflict Group',
						position: 0,
						enabled: true,
						upgradeUntil: false,
						members: [{ name: 'HDTV-720p' }, { name: 'WEBRip-720p' }, { name: 'Bluray-720p' }]
					}
				],
				to: [
					{
						type: 'group',
						name: 'Conflict Group',
						position: 0,
						enabled: true,
						upgradeUntil: false,
						members: [{ name: 'WEBRip-720p' }, { name: 'HDTV-720p' }, { name: 'Bluray-720p' }]
					}
				]
			}
		})
	});

	const alignDraftId = insertOp(dbPath, {
		databaseId: alignDbId,
		origin: 'base',
		state: 'draft',
		sql: 'SELECT 1;',
		sequence: 0
	});
	await client.postForm(
		`/databases/${alignDbId}/changes?/drop`,
		{ opIds: String(alignDraftId) },
		{ headers: { Origin: ORIGIN } }
	);

	// ─── Scenario 5: Add member to existing group ──────────────────────────
	const addPath = await createPcdRepo(basePath, 'group-pos-add');
	addDbId = createDatabaseInstance(dbPath, {
		name: 'group-pos-add',
		uuid: 'group-pos-add',
		localPath: addPath,
		conflictStrategy: 'ask'
	});
	['HDTV-720p', 'WEBRip-720p', 'Bluray-720p'].forEach((name, index) => {
		insertOp(dbPath, {
			databaseId: addDbId,
			origin: 'base',
			state: 'published',
			sql: `INSERT INTO qualities (name) SELECT '${name}' WHERE NOT EXISTS (SELECT 1 FROM qualities WHERE name = '${name}');`,
			sequence: 10 + index
		});
	});
	insertOp(dbPath, {
		databaseId: addDbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_profiles (name, description) VALUES ('Add Profile', 'Test');`,
		sequence: 100
	});
	insertOp(dbPath, {
		databaseId: addDbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_groups (quality_profile_name, name) VALUES ('Add Profile', 'Add Group');`,
		sequence: 110
	});
	['HDTV-720p', 'Bluray-720p'].forEach((member, index) => {
		insertOp(dbPath, {
			databaseId: addDbId,
			origin: 'base',
			state: 'published',
			sql: `INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Add Profile', 'Add Group', '${member}', ${index});`,
			sequence: 120 + index
		});
	});
	insertOp(dbPath, {
		databaseId: addDbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_profile_qualities (quality_profile_name, quality_group_name, quality_name, position, enabled, upgrade_until) VALUES ('Add Profile', 'Add Group', NULL, 0, 1, 0);`,
		sequence: 200
	});
	addUserOpId = insertOp(dbPath, {
		databaseId: addDbId,
		origin: 'user',
		state: 'published',
		sql: buildGuardedGroupRewriteSql(
			'Add Profile',
			'Add Group',
			['HDTV-720p', 'Bluray-720p'],
			['HDTV-720p', 'WEBRip-720p', 'Bluray-720p']
		),
		sequence: 100,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name: 'Add Profile',
			stable_key: { key: 'quality_profile_name', value: 'Add Profile' },
			changed_fields: ['quality_item:group:Add Group']
		}),
		desiredState: JSON.stringify({
			ordered_items: {
				from: [
					{
						type: 'group',
						name: 'Add Group',
						position: 0,
						enabled: true,
						upgradeUntil: false,
						members: [{ name: 'HDTV-720p' }, { name: 'Bluray-720p' }]
					}
				],
				to: [
					{
						type: 'group',
						name: 'Add Group',
						position: 0,
						enabled: true,
						upgradeUntil: false,
						members: [{ name: 'HDTV-720p' }, { name: 'WEBRip-720p' }, { name: 'Bluray-720p' }]
					}
				]
			}
		})
	});
	const addDraftId = insertOp(dbPath, {
		databaseId: addDbId,
		origin: 'base',
		state: 'draft',
		sql: 'SELECT 1;',
		sequence: 0
	});
	await client.postForm(
		`/databases/${addDbId}/changes?/drop`,
		{ opIds: String(addDraftId) },
		{ headers: { Origin: ORIGIN } }
	);

	// ─── Scenario 6: Remove member from existing group ─────────────────────
	const removePath = await createPcdRepo(basePath, 'group-pos-remove');
	removeDbId = createDatabaseInstance(dbPath, {
		name: 'group-pos-remove',
		uuid: 'group-pos-remove',
		localPath: removePath,
		conflictStrategy: 'ask'
	});
	['HDTV-720p', 'WEBRip-720p', 'Bluray-720p'].forEach((name, index) => {
		insertOp(dbPath, {
			databaseId: removeDbId,
			origin: 'base',
			state: 'published',
			sql: `INSERT INTO qualities (name) SELECT '${name}' WHERE NOT EXISTS (SELECT 1 FROM qualities WHERE name = '${name}');`,
			sequence: 10 + index
		});
	});
	insertOp(dbPath, {
		databaseId: removeDbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_profiles (name, description) VALUES ('Remove Profile', 'Test');`,
		sequence: 100
	});
	insertOp(dbPath, {
		databaseId: removeDbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_groups (quality_profile_name, name) VALUES ('Remove Profile', 'Remove Group');`,
		sequence: 110
	});
	['HDTV-720p', 'WEBRip-720p', 'Bluray-720p'].forEach((member, index) => {
		insertOp(dbPath, {
			databaseId: removeDbId,
			origin: 'base',
			state: 'published',
			sql: `INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Remove Profile', 'Remove Group', '${member}', ${index});`,
			sequence: 120 + index
		});
	});
	insertOp(dbPath, {
		databaseId: removeDbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO quality_profile_qualities (quality_profile_name, quality_group_name, quality_name, position, enabled, upgrade_until) VALUES ('Remove Profile', 'Remove Group', NULL, 0, 1, 0);`,
		sequence: 200
	});
	removeUserOpId = insertOp(dbPath, {
		databaseId: removeDbId,
		origin: 'user',
		state: 'published',
		sql: buildGuardedGroupRewriteSql(
			'Remove Profile',
			'Remove Group',
			['HDTV-720p', 'WEBRip-720p', 'Bluray-720p'],
			['HDTV-720p', 'Bluray-720p']
		),
		sequence: 100,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name: 'Remove Profile',
			stable_key: { key: 'quality_profile_name', value: 'Remove Profile' },
			changed_fields: ['quality_item:group:Remove Group']
		}),
		desiredState: JSON.stringify({
			ordered_items: {
				from: [
					{
						type: 'group',
						name: 'Remove Group',
						position: 0,
						enabled: true,
						upgradeUntil: false,
						members: [{ name: 'HDTV-720p' }, { name: 'WEBRip-720p' }, { name: 'Bluray-720p' }]
					}
				],
				to: [
					{
						type: 'group',
						name: 'Remove Group',
						position: 0,
						enabled: true,
						upgradeUntil: false,
						members: [{ name: 'HDTV-720p' }, { name: 'Bluray-720p' }]
					}
				]
			}
		})
	});
	const removeDraftId = insertOp(dbPath, {
		databaseId: removeDbId,
		origin: 'base',
		state: 'draft',
		sql: 'SELECT 1;',
		sequence: 0
	});
	await client.postForm(
		`/databases/${removeDbId}/changes?/drop`,
		{ opIds: String(removeDraftId) },
		{ headers: { Origin: ORIGIN } }
	);
});

teardown(async () => {
	await stopServer(PORT);
});

// ─── Scenario 1: Basic position ordering ────────────────────────────────────

test('basic: all ops compile without conflicts', () => {
	const conflicts = queryLatestConflicts(getDbPath(PORT), basicDbId);
	assertEquals(conflicts.length, 0, 'Expected zero conflicts');
});

test('basic: no errors in compile history', () => {
	const history = queryLatestHistory(getDbPath(PORT), basicDbId);
	const errors = history.filter(
		(h) => h.status === 'error' || h.status === 'conflicted' || h.status === 'conflicted_pending'
	);
	assertEquals(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors)}`);
});

// ─── Scenario 2: Backwards compatibility ────────────────────────────────────

test('compat: old ops without position compile without conflicts', () => {
	const conflicts = queryLatestConflicts(getDbPath(PORT), compatDbId);
	assertEquals(conflicts.length, 0, 'Expected zero conflicts');
});

test('compat: no errors in compile history', () => {
	const history = queryLatestHistory(getDbPath(PORT), compatDbId);
	const errors = history.filter(
		(h) => h.status === 'error' || h.status === 'conflicted' || h.status === 'conflicted_pending'
	);
	assertEquals(errors.length, 0, `Expected no errors, got: ${JSON.stringify(errors)}`);
});

// ─── Scenario 3: Conflict — ask strategy ────────────────────────────────────

test('ask: user reorder op conflicts when upstream also reordered', () => {
	const conflicts = queryLatestConflicts(getDbPath(PORT), askDbId);
	const userConflict = conflicts.find((h) => h.op_id === askUserOpId);
	assertExists(userConflict, 'Expected conflict for user reorder op');
	assertEquals(userConflict.status, 'conflicted_pending');
});

// ─── Scenario 4: Conflict — align strategy ──────────────────────────────────

test('align: user reorder op is auto-dropped', () => {
	const db = new Database(getDbPath(PORT));
	try {
		const op = db.prepare('SELECT state FROM pcd_ops WHERE id = ?').get(alignUserOpId) as {
			state: string;
		};
		assertExists(op);
		assertEquals(op.state, 'dropped');
	} finally {
		db.close();
	}
});

test('align: no remaining conflicts', () => {
	const conflicts = queryLatestConflicts(getDbPath(PORT), alignDbId);
	assertEquals(conflicts.length, 0);
});

// ─── Scenario 5: Add member ────────────────────────────────────────────────

test('add: user add-member op applies without conflicts', () => {
	const history = queryLatestHistory(getDbPath(PORT), addDbId);
	const op = history.find((h) => h.op_id === addUserOpId);
	assertExists(op);
	assertEquals(op.status, 'applied');
});

test('add: new member gets inserted at requested position', async () => {
	const members = await queryCompiledGroupMembers(addDbId, 'Add Profile', 'Add Group');
	assertEquals(members, [
		{ quality_name: 'HDTV-720p', position: 0 },
		{ quality_name: 'WEBRip-720p', position: 1 },
		{ quality_name: 'Bluray-720p', position: 2 }
	]);
});

// ─── Scenario 6: Remove member ─────────────────────────────────────────────

test('remove: user remove-member op applies without conflicts', () => {
	const history = queryLatestHistory(getDbPath(PORT), removeDbId);
	const op = history.find((h) => h.op_id === removeUserOpId);
	assertExists(op);
	assertEquals(op.status, 'applied');
});

test('remove: remaining members keep compact positions', async () => {
	const members = await queryCompiledGroupMembers(removeDbId, 'Remove Profile', 'Remove Group');
	assertEquals(members, [
		{ quality_name: 'HDTV-720p', position: 0 },
		{ quality_name: 'Bluray-720p', position: 1 }
	]);
});

await run();
