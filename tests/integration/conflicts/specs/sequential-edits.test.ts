/**
 * Integration tests: Sequential user edits (the supersession bug fix)
 *
 * Scenario: User edits an entity, then edits it again. Both ops have correct
 * value guards. Before the fix, supersession would mark op #1 as superseded,
 * causing op #2's guard to fail (it expected op #1's result as the base).
 *
 * Tests all 3 strategies: ask, override, align — none should produce conflicts.
 */

import { assertEquals, assertExists } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import {
	createPcdRepo,
	createDatabaseInstance,
	insertOp,
	queryLatestConflicts,
	queryLatestHistory
} from '../harness/setup.ts';

const PORT = 7024;
const ORIGIN = `http://localhost:${PORT}`;

let client: TestClient;

// One database instance per strategy
let askDbId: number;
let askUserOp1Id: number;
let askUserOp2Id: number;
let askDraftId: number;

let overrideDbId: number;
let overrideUserOp1Id: number;
let overrideUserOp2Id: number;
let overrideDraftId: number;

let alignDbId: number;
let alignUserOp1Id: number;
let alignUserOp2Id: number;
let alignDraftId: number;

function seedScenario(
	dbPath: string,
	dbId: number
): { userOp1Id: number; userOp2Id: number; draftId: number } {
	// Base op: create regex with pattern '\boriginal\b'
	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO regular_expressions (name, pattern, description)
		      VALUES ('Seq Regex', '\\boriginal\\b', 'Original');`,
		sequence: 1
	});

	// User op #1: update pattern from '\boriginal\b' to '\bfirst\b' (correct guard)
	const userOp1Id = insertOp(dbPath, {
		databaseId: dbId,
		origin: 'user',
		state: 'published',
		sql: `UPDATE regular_expressions SET pattern = '\\bfirst\\b'
		      WHERE name = 'Seq Regex' AND pattern = '\\boriginal\\b';`,
		sequence: 100,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'regular_expression',
			name: 'Seq Regex',
			stable_key: { key: 'name', value: 'Seq Regex' },
			changed_fields: ['pattern']
		}),
		desiredState: JSON.stringify({
			pattern: { from: '\\boriginal\\b', to: '\\bfirst\\b' }
		})
	});

	// User op #2: update pattern from '\bfirst\b' to '\bsecond\b' (correct guard against op #1)
	const userOp2Id = insertOp(dbPath, {
		databaseId: dbId,
		origin: 'user',
		state: 'published',
		sql: `UPDATE regular_expressions SET pattern = '\\bsecond\\b'
		      WHERE name = 'Seq Regex' AND pattern = '\\bfirst\\b';`,
		sequence: 101,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'regular_expression',
			name: 'Seq Regex',
			stable_key: { key: 'name', value: 'Seq Regex' },
			changed_fields: ['pattern']
		}),
		desiredState: JSON.stringify({
			pattern: { from: '\\bfirst\\b', to: '\\bsecond\\b' }
		})
	});

	// Draft trigger op
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

	// ─── Ask strategy ────────────────────────────────────────────────────────
	const askPath = await createPcdRepo(basePath, 'seq-ask');
	askDbId = createDatabaseInstance(dbPath, {
		name: 'seq-ask',
		uuid: 'seq-ask',
		localPath: askPath,
		conflictStrategy: 'ask'
	});
	({
		userOp1Id: askUserOp1Id,
		userOp2Id: askUserOp2Id,
		draftId: askDraftId
	} = seedScenario(dbPath, askDbId));

	// ─── Override strategy ───────────────────────────────────────────────────
	const overridePath = await createPcdRepo(basePath, 'seq-override');
	overrideDbId = createDatabaseInstance(dbPath, {
		name: 'seq-override',
		uuid: 'seq-override',
		localPath: overridePath,
		conflictStrategy: 'override'
	});
	({
		userOp1Id: overrideUserOp1Id,
		userOp2Id: overrideUserOp2Id,
		draftId: overrideDraftId
	} = seedScenario(dbPath, overrideDbId));

	// ─── Align strategy ──────────────────────────────────────────────────────
	const alignPath = await createPcdRepo(basePath, 'seq-align');
	alignDbId = createDatabaseInstance(dbPath, {
		name: 'seq-align',
		uuid: 'seq-align',
		localPath: alignPath,
		conflictStrategy: 'align'
	});
	({
		userOp1Id: alignUserOp1Id,
		userOp2Id: alignUserOp2Id,
		draftId: alignDraftId
	} = seedScenario(dbPath, alignDbId));

	// Trigger compiles
	for (const [dbId, draftId] of [
		[askDbId, askDraftId],
		[overrideDbId, overrideDraftId],
		[alignDbId, alignDraftId]
	]) {
		await client.postForm(
			`/databases/${dbId}/changes?/drop`,
			{ opIds: String(draftId) },
			{ headers: { Origin: ORIGIN } }
		);
	}
});

teardown(async () => {
	await stopServer(PORT);
});

// ─── Ask strategy ────────────────────────────────────────────────────────────

test('ask: no conflicts with sequential edits', () => {
	const conflicts = queryLatestConflicts(getDbPath(PORT), askDbId);
	assertEquals(conflicts.length, 0, 'Expected zero conflicts');
});

test('ask: both user ops applied', () => {
	const history = queryLatestHistory(getDbPath(PORT), askDbId);
	const op1 = history.find((h) => h.op_id === askUserOp1Id);
	const op2 = history.find((h) => h.op_id === askUserOp2Id);
	assertExists(op1, 'Expected history for user op #1');
	assertExists(op2, 'Expected history for user op #2');
	assertEquals(op1.status, 'applied');
	assertEquals(op2.status, 'applied');
});

// ─── Override strategy ───────────────────────────────────────────────────────

test('override: no conflicts with sequential edits', () => {
	const conflicts = queryLatestConflicts(getDbPath(PORT), overrideDbId);
	assertEquals(conflicts.length, 0, 'Expected zero conflicts');
});

test('override: both user ops applied', () => {
	const history = queryLatestHistory(getDbPath(PORT), overrideDbId);
	const op1 = history.find((h) => h.op_id === overrideUserOp1Id);
	const op2 = history.find((h) => h.op_id === overrideUserOp2Id);
	assertExists(op1, 'Expected history for user op #1');
	assertExists(op2, 'Expected history for user op #2');
	assertEquals(op1.status, 'applied');
	assertEquals(op2.status, 'applied');
});

// ─── Align strategy ──────────────────────────────────────────────────────────

test('align: no conflicts with sequential edits', () => {
	const conflicts = queryLatestConflicts(getDbPath(PORT), alignDbId);
	assertEquals(conflicts.length, 0, 'Expected zero conflicts');
});

test('align: both user ops applied', () => {
	const history = queryLatestHistory(getDbPath(PORT), alignDbId);
	const op1 = history.find((h) => h.op_id === alignUserOp1Id);
	const op2 = history.find((h) => h.op_id === alignUserOp2Id);
	assertExists(op1, 'Expected history for user op #1');
	assertExists(op2, 'Expected history for user op #2');
	assertEquals(op1.status, 'applied');
	assertEquals(op2.status, 'applied');
});

await run();
