/**
 * PCD write tests: regex create.
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { base } from '../../harness/fixtures.ts';
import {
	compilePcd,
	normalizeSql,
	opCheckpoint,
	parseDesiredState,
	parseMetadata
} from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import { assertActionFailed, createScenarioFactory, userOpsSince } from './helpers.ts';

const PORT = 7037;
const ORIGIN = `http://localhost:${PORT}`;

const { newPcd, seededPcd } = createScenarioFactory(PORT, 'pcd-write-regex-create');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

test('minimal regex emits one create op', async () => {
	const ctx = await newPcd('minimal');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.create(ctx, {
		name: 'Created Regex',
		pattern: '\\bcreated\\b'
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = ops[0];
	assertEquals(parseMetadata(op).operation, 'create');
	assertEquals(parseMetadata(op).entity, 'regular_expression');
	assertEquals(parseMetadata(op).name, 'Created Regex');
	const desired = parseDesiredState(op);
	assertEquals(desired.name, 'Created Regex');
	assertEquals(desired.pattern, '\\bcreated\\b');
	assertEquals(desired.description, null);
	assertEquals(desired.regex101_id, null);
	assertEquals(desired.tags, []);
	assert(/insert into "?regular_expressions"?/i.test(normalizeSql(op.sql)));
});

test('details and tags are persisted in one create op', async () => {
	const ctx = await newPcd('details');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.create(ctx, {
		name: 'Detailed Regex',
		pattern: '\\bdetailed\\b',
		description: 'Detailed description',
		regex101Id: 'abc123',
		tags: ['Anime', 'HDR', 'Anime', '  ']
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = ops[0];
	const desired = parseDesiredState(op);
	assertEquals(desired.description, 'Detailed description');
	assertEquals(desired.regex101_id, 'abc123');
	assertEquals(desired.tags, ['Anime', 'HDR']);
	const sql = normalizeSql(op.sql);
	assert(sql.includes("'Anime'"));
	assert(sql.includes("'HDR'"));
	assertEquals(countOccurrences(sql, `'Detailed Regex', 'Anime'`), 1);
	assertEquals(countOccurrences(sql, `'Detailed Regex', 'HDR'`), 1);
});

test('duplicate name fails without writing ops', async () => {
	const ctx = await seededPcd('duplicate', [
		base.regex({ name: 'Existing Regex', pattern: '\\bexisting\\b' })
	]);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.regex.submitCreate(ctx, {
		name: 'existing regex',
		pattern: '\\bduplicate\\b'
	});

	await assertActionFailed(response);
	assertEquals(userOpsSince(ctx, checkpoint).length, 0);
});

function countOccurrences(value: string, search: string): number {
	return value.split(search).length - 1;
}

await run();
