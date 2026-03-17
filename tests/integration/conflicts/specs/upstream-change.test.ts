/**
 * Integration tests: Upstream base change causes real conflicts
 *
 * Scenario: User makes two sequential edits (correct guards between them).
 * Then the base gets an upstream update to the same field. The user ops'
 * guards no longer match the new base state → real conflicts.
 *
 * Tests all 3 strategies:
 * - ask: both user ops get conflicted_pending
 * - override: auto-resolved (old ops dropped, new ops created)
 * - align: auto-dropped
 */

import { assertEquals, assertExists, assert } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import {
	createPcdRepo,
	createDatabaseInstance,
	insertOp,
	queryLatestConflicts,
	queryLatestHistory,
	queryOp,
	queryOpsByDatabase
} from '../harness/setup.ts';

const PORT = 7025;
const ORIGIN = `http://localhost:${PORT}`;

let client: TestClient;

// ─── Ask ─────────────────────────────────────────────────────────────────────

let askDbId: number;
let askUserOp1Id: number;
let askUserOp2Id: number;

// ─── Override ────────────────────────────────────────────────────────────────

let overrideDbId: number;
let overrideUserOp1Id: number;
let overrideUserOp2Id: number;

// ─── Align ───────────────────────────────────────────────────────────────────

let alignDbId: number;
let alignUserOp1Id: number;
let alignUserOp2Id: number;

function seedScenario(
	dbPath: string,
	dbId: number
): { userOp1Id: number; userOp2Id: number; draftId: number } {
	// Base op #1: create regex
	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO regular_expressions (name, pattern, description)
		      VALUES ('Upstream Regex', '\\boriginal\\b', 'Original');`,
		sequence: 1
	});

	// Base op #2: upstream changes the pattern (simulates a pull)
	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `UPDATE regular_expressions SET pattern = '\\bupstream\\b'
		      WHERE name = 'Upstream Regex' AND pattern = '\\boriginal\\b';`,
		sequence: 2
	});

	// User op #1: guard expects '\boriginal\b' but base now has '\bupstream\b'
	const userOp1Id = insertOp(dbPath, {
		databaseId: dbId,
		origin: 'user',
		state: 'published',
		sql: `UPDATE regular_expressions SET pattern = '\\bfirst\\b'
		      WHERE name = 'Upstream Regex' AND pattern = '\\boriginal\\b';`,
		sequence: 100,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'regular_expression',
			name: 'Upstream Regex',
			stable_key: { key: 'name', value: 'Upstream Regex' },
			changed_fields: ['pattern']
		}),
		desiredState: JSON.stringify({
			pattern: { from: '\\boriginal\\b', to: '\\bfirst\\b' }
		})
	});

	// User op #2: guard expects '\bfirst\b' (from op #1) — also fails
	const userOp2Id = insertOp(dbPath, {
		databaseId: dbId,
		origin: 'user',
		state: 'published',
		sql: `UPDATE regular_expressions SET pattern = '\\bsecond\\b'
		      WHERE name = 'Upstream Regex' AND pattern = '\\bfirst\\b';`,
		sequence: 101,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'regular_expression',
			name: 'Upstream Regex',
			stable_key: { key: 'name', value: 'Upstream Regex' },
			changed_fields: ['pattern']
		}),
		desiredState: JSON.stringify({
			pattern: { from: '\\bfirst\\b', to: '\\bsecond\\b' }
		})
	});

	// Draft trigger
	const draftId = insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'draft',
		sql: 'SELECT 1;',
		sequence: 0
	});

	return { userOp1Id, userOp2Id, draftId };
}

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN });
	client = new TestClient(ORIGIN);

	const basePath = `./dist/integration-${PORT}`;
	const dbPath = getDbPath(PORT);

	// ─── Ask ─────────────────────────────────────────────────────────────────
	const askPath = await createPcdRepo(basePath, 'upstream-ask');
	askDbId = createDatabaseInstance(dbPath, {
		name: 'upstream-ask',
		uuid: 'upstream-ask',
		localPath: askPath,
		conflictStrategy: 'ask'
	});
	let draftId: number;
	({ userOp1Id: askUserOp1Id, userOp2Id: askUserOp2Id, draftId } = seedScenario(dbPath, askDbId));
	await client.postForm(
		`/databases/${askDbId}/changes?/drop`,
		{ opIds: String(draftId) },
		{ headers: { Origin: ORIGIN } }
	);

	// ─── Override ────────────────────────────────────────────────────────────
	const overridePath = await createPcdRepo(basePath, 'upstream-override');
	overrideDbId = createDatabaseInstance(dbPath, {
		name: 'upstream-override',
		uuid: 'upstream-override',
		localPath: overridePath,
		conflictStrategy: 'override'
	});
	({
		userOp1Id: overrideUserOp1Id,
		userOp2Id: overrideUserOp2Id,
		draftId
	} = seedScenario(dbPath, overrideDbId));
	await client.postForm(
		`/databases/${overrideDbId}/changes?/drop`,
		{ opIds: String(draftId) },
		{ headers: { Origin: ORIGIN } }
	);

	// ─── Align ───────────────────────────────────────────────────────────────
	const alignPath = await createPcdRepo(basePath, 'upstream-align');
	alignDbId = createDatabaseInstance(dbPath, {
		name: 'upstream-align',
		uuid: 'upstream-align',
		localPath: alignPath,
		conflictStrategy: 'align'
	});
	({
		userOp1Id: alignUserOp1Id,
		userOp2Id: alignUserOp2Id,
		draftId
	} = seedScenario(dbPath, alignDbId));
	await client.postForm(
		`/databases/${alignDbId}/changes?/drop`,
		{ opIds: String(draftId) },
		{ headers: { Origin: ORIGIN } }
	);
});

teardown(async () => {
	await stopServer(PORT);
});

// ─── Ask: both ops should be conflicted_pending ──────────────────────────────

test('ask: user op #1 is conflicted_pending', () => {
	const conflicts = queryLatestConflicts(getDbPath(PORT), askDbId);
	const op1 = conflicts.find((h) => h.op_id === askUserOp1Id);
	assertExists(op1, 'Expected conflict for user op #1');
	assertEquals(op1.status, 'conflicted_pending');
	assertEquals(op1.conflict_reason, 'guard_mismatch');
});

test('ask: user op #2 is conflicted_pending', () => {
	const conflicts = queryLatestConflicts(getDbPath(PORT), askDbId);
	const op2 = conflicts.find((h) => h.op_id === askUserOp2Id);
	assertExists(op2, 'Expected conflict for user op #2');
	assertEquals(op2.status, 'conflicted_pending');
	assertEquals(op2.conflict_reason, 'guard_mismatch');
});

// ─── Override: auto-resolved ─────────────────────────────────────────────────

test('override: original user ops are dropped or superseded', () => {
	const op1 = queryOp(getDbPath(PORT), overrideUserOp1Id);
	const op2 = queryOp(getDbPath(PORT), overrideUserOp2Id);
	assertExists(op1);
	assertExists(op2);
	const valid = ['dropped', 'superseded'];
	assert(valid.includes(op1.state), `Op #1 state: expected dropped/superseded, got ${op1.state}`);
	assert(valid.includes(op2.state), `Op #2 state: expected dropped/superseded, got ${op2.state}`);
});

test('override: new published user op exists', () => {
	const userOps = queryOpsByDatabase(getDbPath(PORT), overrideDbId, {
		origin: 'user',
		state: 'published'
	});
	assert(userOps.length > 0, 'Expected at least one new published user op');
});

test('override: no remaining conflicts', () => {
	const conflicts = queryLatestConflicts(getDbPath(PORT), overrideDbId);
	assertEquals(conflicts.length, 0);
});

// ─── Align: auto-dropped ─────────────────────────────────────────────────────

test('align: user op #1 is dropped', () => {
	const op = queryOp(getDbPath(PORT), alignUserOp1Id);
	assertExists(op);
	assertEquals(op.state, 'dropped');
});

test('align: user op #2 is dropped', () => {
	const op = queryOp(getDbPath(PORT), alignUserOp2Id);
	assertExists(op);
	assertEquals(op.state, 'dropped');
});

test('align: no remaining conflicts', () => {
	const conflicts = queryLatestConflicts(getDbPath(PORT), alignDbId);
	assertEquals(conflicts.length, 0);
});

await run();
