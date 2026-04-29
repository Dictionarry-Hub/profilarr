/**
 * Integration test: deleting a regex and renaming another regex into the same
 * name must not orphan generated custom-format condition draft ops.
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

const PORT = 7034;
const ORIGIN = `http://localhost:${PORT}`;

let client: TestClient;
let dbId: number;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
	client = new TestClient(ORIGIN);

	const basePath = `./dist/integration-${PORT}`;
	const dbPath = getDbPath(PORT);

	const pcdPath = await createPcdRepo(basePath, 'regex-delete-rename-generated-draft');
	dbId = createDatabaseInstance(dbPath, {
		name: 'regex-delete-rename-generated-draft',
		uuid: 'regex-delete-rename-generated-draft',
		localPath: pcdPath,
		conflictStrategy: 'ask',
		canWriteToBase: true
	});

	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO regular_expressions (name, pattern, description)
		      VALUES ('E', '^(ENJOi|EUBDS)$', '');`,
		sequence: 1
	});

	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO regular_expressions (name, pattern, description)
		      VALUES ('E (2)', '^(Erai-raws)$', '');`,
		sequence: 2
	});

	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO custom_formats (name, description, include_in_rename)
		      VALUES ('LQ', '', 0);`,
		sequence: 3
	});

	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO custom_format_conditions
		        (custom_format_name, name, type, arr_type, negate, required)
		      VALUES ('LQ', 'Release Group', 'release_group', 'all', 0, 0);`,
		sequence: 4
	});

	insertOp(dbPath, {
		databaseId: dbId,
		origin: 'base',
		state: 'published',
		sql: `INSERT INTO condition_patterns
		        (custom_format_name, condition_name, regular_expression_name)
		      VALUES ('LQ', 'Release Group', 'E (2)');`,
		sequence: 5
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

	const deleteResponse = await client.postForm(
		`/regular-expressions/${dbId}/1?/delete`,
		{ layer: 'base' },
		{ headers: { Origin: ORIGIN } }
	);
	assert(
		deleteResponse.status >= 200 && deleteResponse.status < 400,
		`Expected 2xx/3xx from delete action, got ${deleteResponse.status}`
	);

	const renameResponse = await client.postForm(
		`/regular-expressions/${dbId}/2?/update`,
		{
			name: 'E',
			pattern: '^(Erai-raws)$',
			description: '',
			tags: '[]',
			regex101Id: '',
			layer: 'base'
		},
		{ headers: { Origin: ORIGIN } }
	);
	assert(
		renameResponse.status >= 200 && renameResponse.status < 400,
		`Expected 2xx/3xx from rename action, got ${renameResponse.status}`
	);
});

teardown(async () => {
	await stopServer(PORT);
});

test('draft changes keep delete and rename groups separate and exportable', async () => {
	const draftOps = queryOpsByDatabase(getDbPath(PORT), dbId, {
		origin: 'base',
		state: 'draft'
	});
	const deleteOp = draftOps.find((o) => {
		const meta = JSON.parse(o.metadata ?? '{}');
		return meta.entity === 'regular_expression' && meta.operation === 'delete' && meta.name === 'E';
	});
	const renameOp = draftOps.find((o) => {
		const meta = JSON.parse(o.metadata ?? '{}');
		return (
			meta.entity === 'regular_expression' &&
			meta.operation === 'update' &&
			meta.previousName === 'E (2)' &&
			meta.name === 'E'
		);
	});
	const generatedOp = draftOps.find((o) => {
		const meta = JSON.parse(o.metadata ?? '{}');
		return meta.entity === 'custom_format' && meta.generated === true && meta.name === 'LQ';
	});

	assertExists(deleteOp, 'Expected draft delete op for regex E');
	assertExists(renameOp, 'Expected draft rename op for regex E (2) -> E');
	assertExists(generatedOp, 'Expected generated draft condition update for custom format LQ');

	const deleteGroupId = JSON.parse(deleteOp.metadata ?? '{}').group_id;
	const renameGroupId = JSON.parse(renameOp.metadata ?? '{}').group_id;
	const generatedGroupId = JSON.parse(generatedOp.metadata ?? '{}').group_id;
	assertExists(deleteGroupId, 'Delete op should have a group_id');
	assertExists(renameGroupId, 'Rename op should have a group_id');
	assertEquals(generatedGroupId, renameGroupId, 'Generated op should share the rename group');
	assert(deleteGroupId !== renameGroupId, 'Delete and rename actions should have distinct groups');

	const response = await client.get(`/databases/${dbId}/changes/data`);
	assertEquals(response.status, 200);
	const payload = await response.json();
	const changes = payload.draftChanges as Array<{
		key: string;
		entity: string;
		name: string;
		groupId?: string;
		generated?: boolean;
		ops: Array<{ id: number }>;
	}>;

	const deleteChange = changes.find(
		(change) =>
			change.entity === 'regular_expression' &&
			change.groupId === deleteGroupId &&
			change.generated !== true
	);
	const renameChange = changes.find(
		(change) =>
			change.entity === 'regular_expression' &&
			change.groupId === renameGroupId &&
			change.generated !== true
	);
	const generatedChange = changes.find(
		(change) =>
			change.entity === 'custom_format' &&
			change.groupId === renameGroupId &&
			change.generated === true
	);

	assertExists(deleteChange, 'Delete action should have its own selectable change row');
	assertExists(renameChange, 'Rename action should have its own selectable change row');
	assertExists(generatedChange, 'Generated condition change should stay attached to rename group');
	assert(
		renameChange.ops.some((op) => op.id === renameOp.id),
		'Rename row should contain the rename op'
	);
	assert(
		!renameChange.ops.some((op) => op.id === deleteOp.id),
		'Rename row should not contain the delete op'
	);
});

await run();
