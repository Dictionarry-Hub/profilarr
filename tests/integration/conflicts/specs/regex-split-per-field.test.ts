/**
 * Integration tests: Regex update writer emits one op per changed field
 *
 * Drives the regex update form action with two fields changed (pattern +
 * description) and verifies the writer emits two separate user ops, each
 * carrying single-field metadata, sharing a groupId. Pre-split, this would
 * have produced one bundled op with both fields' value guards in a single
 * UPDATE — the whole thing failing if either guard didn't match.
 */

import { assertEquals, assertExists, assert } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import {
	createPcdRepo,
	createDatabaseInstance,
	insertOp,
	queryOpsByDatabase
} from '../harness/setup.ts';

const PORT = 7027;
const ORIGIN = `http://localhost:${PORT}`;

let client: TestClient;
let dbId: number;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
	client = new TestClient(ORIGIN);

	const basePath = `./dist/integration-${PORT}`;
	const dbPath = getDbPath(PORT);

	const pcdPath = await createPcdRepo(basePath, 'regex-split-per-field');
	dbId = createDatabaseInstance(dbPath, {
		name: 'regex-split-per-field',
		uuid: 'regex-split-per-field',
		localPath: pcdPath,
		conflictStrategy: 'ask'
	});

	// Base op #1: create the regex
	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO regular_expressions (name, pattern, description)
		      VALUES ('TestRegex', '\\bold\\b', 'Old');`,
		sequence: 1
	});

	// Draft trigger so dropping it forces an initial compile
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

	// Drive the writer through the form action — change pattern AND description
	const response = await client.postForm(
		`/regular-expressions/${dbId}/1?/update`,
		{
			name: 'TestRegex',
			pattern: '\\bnew\\b',
			description: 'New description',
			tags: '[]',
			regex101Id: '',
			layer: 'user'
		},
		{ headers: { Origin: ORIGIN } }
	);

	// SvelteKit form actions return 200 with a JSON-wrapped success payload
	// (the redirect is a client-side hint, not a 303). Just confirm not 4xx/5xx.
	assert(
		response.status >= 200 && response.status < 400,
		`Expected 2xx/3xx from form action, got ${response.status}`
	);
});

teardown(async () => {
	await stopServer(PORT);
});

// ─── Assertions ──────────────────────────────────────────────────────────────

test('writer emits exactly two user ops for a two-field update', () => {
	const userOps = queryOpsByDatabase(getDbPath(PORT), dbId, {
		origin: 'user',
		state: 'published'
	});
	assertEquals(
		userOps.length,
		2,
		`Expected 2 published user ops (one per changed field), got ${userOps.length}`
	);
});

test('description op carries changed_fields=[description] only', () => {
	const userOps = queryOpsByDatabase(getDbPath(PORT), dbId, {
		origin: 'user',
		state: 'published'
	});
	const descOp = userOps.find((o) => {
		const meta = JSON.parse(o.metadata ?? '{}');
		return meta.changed_fields?.length === 1 && meta.changed_fields[0] === 'description';
	});
	assertExists(descOp, 'Expected a user op with changed_fields=[description]');
	assert(
		/set\s+"description"/i.test(descOp.sql),
		`Description op SQL should set description, got: ${descOp.sql}`
	);
	assert(
		!/set\s+"pattern"/i.test(descOp.sql),
		`Description op SQL must not also touch pattern, got: ${descOp.sql}`
	);
});

test('pattern op carries changed_fields=[pattern] only', () => {
	const userOps = queryOpsByDatabase(getDbPath(PORT), dbId, {
		origin: 'user',
		state: 'published'
	});
	const patternOp = userOps.find((o) => {
		const meta = JSON.parse(o.metadata ?? '{}');
		return meta.changed_fields?.length === 1 && meta.changed_fields[0] === 'pattern';
	});
	assertExists(patternOp, 'Expected a user op with changed_fields=[pattern]');
	assert(
		/set\s+"pattern"/i.test(patternOp.sql),
		`Pattern op SQL should set pattern, got: ${patternOp.sql}`
	);
	assert(
		!/set\s+"description"/i.test(patternOp.sql),
		`Pattern op SQL must not also touch description, got: ${patternOp.sql}`
	);
});

test('both ops share the same group_id', () => {
	const userOps = queryOpsByDatabase(getDbPath(PORT), dbId, {
		origin: 'user',
		state: 'published'
	});
	const groupIds = userOps.map((o) => JSON.parse(o.metadata ?? '{}').group_id);
	assertEquals(groupIds.length, 2);
	assertExists(groupIds[0], 'First op should have a group_id');
	assertEquals(groupIds[0], groupIds[1], 'Both per-field ops should share one group_id');
});

test('each op carries a from/to desired_state for its single field', () => {
	const userOps = queryOpsByDatabase(getDbPath(PORT), dbId, {
		origin: 'user',
		state: 'published'
	});

	for (const op of userOps) {
		const meta = JSON.parse(op.metadata ?? '{}');
		const desired = JSON.parse(op.desired_state ?? '{}');
		const field = meta.changed_fields?.[0];
		assertExists(field);
		const entry = desired[field];
		assertExists(entry, `desired_state should carry an entry for "${field}"`);
		assert(
			'from' in entry && 'to' in entry,
			`desired_state.${field} should have from/to keys, got ${JSON.stringify(entry)}`
		);
	}
});

await run();
