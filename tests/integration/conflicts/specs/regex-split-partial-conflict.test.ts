/**
 * Integration tests: Per-field user ops survive a partial upstream conflict
 *
 * Models the post-split shape of two user edits to the same regex (description
 * + pattern) as two independent ops with field-scoped value guards. An upstream
 * base change touches only description. The description user op should
 * conflict, but the pattern user op should apply cleanly — the whole point of
 * splitting.
 *
 * Pre-split (a single bundled op with both guards), the description guard
 * mismatch would have failed the entire UPDATE and the user's pattern change
 * would have been lost too.
 */

import { assertEquals, assertExists } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import {
	createPcdRepo,
	createDatabaseInstance,
	insertOp,
	queryLatestConflicts,
	queryLatestHistory
} from '../harness/setup.ts';

const PORT = PORTS.conflicts.regexSplitPartialConflict;
const ORIGIN = `http://localhost:${PORT}`;

let client: TestClient;
let dbId: number;
let descUserOpId: number;
let patternUserOpId: number;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
	client = new TestClient(ORIGIN);

	const basePath = `./dist/integration-${PORT}`;
	const dbPath = getDbPath(PORT);

	const pcdPath = await createPcdRepo(basePath, 'regex-split-partial-conflict');
	dbId = createDatabaseInstance(dbPath, {
		name: 'regex-split-partial-conflict',
		uuid: 'regex-split-partial-conflict',
		localPath: pcdPath,
		conflictStrategy: 'ask'
	});

	// Base op #1: create the regex with description='Old', pattern='\bold\b'
	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO regular_expressions (name, pattern, description)
		      VALUES ('SplitRegex', '\\bold\\b', 'Old');`,
		sequence: 1
	});

	// Base op #2: simulated upstream pull — description changes 'Old' -> 'Upstream'
	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `UPDATE regular_expressions SET description = 'Upstream'
		      WHERE name = 'SplitRegex' AND description = 'Old';`,
		sequence: 2
	});

	// User op #1: description-only update with field guard. Guard expects 'Old'
	// but the upstream change made it 'Upstream' → guard mismatch, conflict.
	descUserOpId = insertOp(dbPath, {
		databaseId: dbId,
		origin: 'user',
		state: 'published',
		sql: `UPDATE regular_expressions SET description = 'User'
		      WHERE name = 'SplitRegex' AND description = 'Old';`,
		sequence: 100,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'regular_expression',
			name: 'SplitRegex',
			stable_key: { key: 'regular_expression_name', value: 'SplitRegex' },
			changed_fields: ['description']
		}),
		desiredState: JSON.stringify({
			description: { from: 'Old', to: 'User' }
		})
	});

	// User op #2: pattern-only update with field guard. Pattern wasn't touched
	// upstream, so the guard matches and the op applies cleanly.
	patternUserOpId = insertOp(dbPath, {
		databaseId: dbId,
		origin: 'user',
		state: 'published',
		sql: `UPDATE regular_expressions SET pattern = '\\bnew\\b'
		      WHERE name = 'SplitRegex' AND pattern = '\\bold\\b';`,
		sequence: 101,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'regular_expression',
			name: 'SplitRegex',
			stable_key: { key: 'regular_expression_name', value: 'SplitRegex' },
			changed_fields: ['pattern']
		}),
		desiredState: JSON.stringify({
			pattern: { from: '\\bold\\b', to: '\\bnew\\b' }
		})
	});

	const draftId = insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'draft',
		sql: 'SELECT 1;',
		sequence: 0
	});

	await client.postForm(
		`/databases/${dbId}/changes?/drop`,
		{ opIds: String(draftId) },
		{ headers: { Origin: ORIGIN } }
	);
});

teardown(async () => {
	await stopServer(PORT);
});

// ─── Assertions ──────────────────────────────────────────────────────────────

test('description user op is conflicted_pending with guard_mismatch', () => {
	const conflicts = queryLatestConflicts(getDbPath(PORT), dbId);
	const descConflict = conflicts.find((h) => h.op_id === descUserOpId);
	assertExists(descConflict, 'Expected a conflict entry for the description user op');
	assertEquals(descConflict.status, 'conflicted_pending');
	assertEquals(descConflict.conflict_reason, 'guard_mismatch');
});

test('pattern user op applied cleanly', () => {
	const history = queryLatestHistory(getDbPath(PORT), dbId);
	const patternHistory = history.find((h) => h.op_id === patternUserOpId);
	assertExists(patternHistory, 'Expected a history entry for the pattern user op');
	assertEquals(
		patternHistory.status,
		'applied',
		`Pattern user op should apply since pattern wasn't touched upstream, got status=${patternHistory.status}`
	);
});

test('only the description op is in the conflict list', () => {
	const conflicts = queryLatestConflicts(getDbPath(PORT), dbId);
	const patternConflict = conflicts.find((h) => h.op_id === patternUserOpId);
	assertEquals(
		patternConflict,
		undefined,
		'Pattern op should not appear in conflicts — splitting isolates field-level conflicts'
	);
});

await run();
