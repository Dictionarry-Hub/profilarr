/**
 * Integration tests: Regex rename cascades into a grouped condition_patterns op
 *
 * When a regex referenced by a custom format condition is renamed, the writer
 * emits a rename op on regular_expressions plus one generated cascade op per
 * affected custom format updating its condition_patterns rows. All ops must
 * share a groupId so a single user-facing action stays atomic across align /
 * override / ask resolution.
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

const PORT = 7029;
const ORIGIN = `http://localhost:${PORT}`;

let client: TestClient;
let dbId: number;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
	client = new TestClient(ORIGIN);

	const basePath = `./dist/integration-${PORT}`;
	const dbPath = getDbPath(PORT);

	const pcdPath = await createPcdRepo(basePath, 'regex-split-rename-cascade');
	dbId = createDatabaseInstance(dbPath, {
		name: 'regex-split-rename-cascade',
		uuid: 'regex-split-rename-cascade',
		localPath: pcdPath,
		conflictStrategy: 'ask'
	});

	// Base op #1: the regex
	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO regular_expressions (name, pattern, description)
		      VALUES ('TestRegex', '\\bx\\b', '');`,
		sequence: 1
	});

	// Base op #2: a custom format
	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO custom_formats (name, description, include_in_rename)
		      VALUES ('CF1', '', 0);`,
		sequence: 2
	});

	// Base op #3: a release_title condition referencing the regex
	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO custom_format_conditions
		        (custom_format_name, name, type, arr_type, negate, required)
		      VALUES ('CF1', 'cond1', 'release_title', 'all', 0, 0);`,
		sequence: 3
	});

	// Base op #4: link the condition to the regex
	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO condition_patterns
		        (custom_format_name, condition_name, regular_expression_name)
		      VALUES ('CF1', 'cond1', 'TestRegex');`,
		sequence: 4
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

	// Drive the writer through the form action — name change only
	const response = await client.postForm(
		`/regular-expressions/${dbId}/1?/update`,
		{
			name: 'RenamedRegex',
			pattern: '\\bx\\b',
			description: '',
			tags: '[]',
			regex101Id: '',
			layer: 'user'
		},
		{ headers: { Origin: ORIGIN } }
	);

	assert(
		response.status >= 200 && response.status < 400,
		`Expected 2xx/3xx from form action, got ${response.status}`
	);
});

teardown(async () => {
	await stopServer(PORT);
});

// ─── Assertions ──────────────────────────────────────────────────────────────

test('rename emits a regular_expression op and a generated custom_format op', () => {
	const userOps = queryOpsByDatabase(getDbPath(PORT), dbId, {
		origin: 'user',
		state: 'published'
	});
	const renameOp = userOps.find((o) => {
		const meta = JSON.parse(o.metadata ?? '{}');
		return (
			meta.entity === 'regular_expression' &&
			meta.changed_fields?.length === 1 &&
			meta.changed_fields[0] === 'name'
		);
	});
	const cascadeOp = userOps.find((o) => {
		const meta = JSON.parse(o.metadata ?? '{}');
		return meta.entity === 'custom_format' && meta.generated === true;
	});
	assertExists(renameOp, 'Expected a rename op (entity=regular_expression, changed_fields=[name])');
	assertExists(cascadeOp, 'Expected a generated cascade op (entity=custom_format)');
});

test('rename op carries previousName', () => {
	const userOps = queryOpsByDatabase(getDbPath(PORT), dbId, {
		origin: 'user',
		state: 'published'
	});
	const renameOp = userOps.find((o) => {
		const meta = JSON.parse(o.metadata ?? '{}');
		return meta.entity === 'regular_expression' && meta.changed_fields?.[0] === 'name';
	});
	assertExists(renameOp);
	const meta = JSON.parse(renameOp.metadata ?? '{}');
	assertEquals(meta.previousName, 'TestRegex', 'Rename op metadata should record the old name');
	assertEquals(meta.name, 'RenamedRegex', 'Rename op metadata.name should be the new name');
});

test('cascade op depends on the renamed regex', () => {
	const userOps = queryOpsByDatabase(getDbPath(PORT), dbId, {
		origin: 'user',
		state: 'published'
	});
	const cascadeOp = userOps.find((o) => {
		const meta = JSON.parse(o.metadata ?? '{}');
		return meta.entity === 'custom_format' && meta.generated === true;
	});
	assertExists(cascadeOp);
	const meta = JSON.parse(cascadeOp.metadata ?? '{}');
	assertEquals(meta.changed_fields?.[0], 'conditions');
	assertExists(meta.depends_on, 'Cascade op should declare depends_on');
	const dep = (meta.depends_on as Array<{ entity: string; key: string; value: string }>).find(
		(d) => d.entity === 'regular_expression'
	);
	assertExists(dep, 'depends_on should include the regular_expression entity');
	assertEquals(dep.value, 'RenamedRegex', 'depends_on should point at the new regex name');
});

test('rename op and cascade op share the same group_id', () => {
	const userOps = queryOpsByDatabase(getDbPath(PORT), dbId, {
		origin: 'user',
		state: 'published'
	});
	const renameOp = userOps.find((o) => {
		const meta = JSON.parse(o.metadata ?? '{}');
		return meta.entity === 'regular_expression' && meta.changed_fields?.[0] === 'name';
	});
	const cascadeOp = userOps.find((o) => {
		const meta = JSON.parse(o.metadata ?? '{}');
		return meta.entity === 'custom_format' && meta.generated === true;
	});
	assertExists(renameOp);
	assertExists(cascadeOp);
	const renameMeta = JSON.parse(renameOp.metadata ?? '{}');
	const cascadeMeta = JSON.parse(cascadeOp.metadata ?? '{}');
	assertExists(
		renameMeta.group_id,
		'Rename op should have a group_id (rename + dependents → grouped)'
	);
	assertEquals(
		renameMeta.group_id,
		cascadeMeta.group_id,
		'Rename op and cascade op should share one group_id'
	);
});

test('cascade op SQL targets condition_patterns, not regular_expressions', () => {
	const userOps = queryOpsByDatabase(getDbPath(PORT), dbId, {
		origin: 'user',
		state: 'published'
	});
	const cascadeOp = userOps.find((o) => {
		const meta = JSON.parse(o.metadata ?? '{}');
		return meta.entity === 'custom_format' && meta.generated === true;
	});
	assertExists(cascadeOp);
	assert(
		cascadeOp.sql.includes('condition_patterns'),
		`Cascade op SQL should update condition_patterns, got: ${cascadeOp.sql}`
	);
});

await run();
