/**
 * PCD write tests: regex delete.
 */

import { assert, assertEquals, assertExists } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { base } from '../../harness/fixtures.ts';
import {
	normalizeSql,
	opCheckpoint,
	parseDesiredState,
	parseMetadata,
	setFailOnReferencedDelete,
	type JsonObject
} from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import {
	assertActionFailed,
	assertSameGroup,
	createScenarioFactory,
	generatedCustomFormatOp,
	userOpsSince
} from './helpers.ts';

const PORT = 7040;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-regex-delete');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

test('unreferenced regex emits one delete op', async () => {
	const ctx = await seededPcd('simple', [
		base.regex({ name: 'Delete Regex', pattern: '\\bdelete\\b' })
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.remove(ctx, 1);

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = ops[0];
	assertEquals(parseMetadata(op).operation, 'delete');
	assertEquals(parseMetadata(op).changed_fields, ['deleted']);
	assertEquals(parseDesiredState(op).deleted, true);
	const sql = normalizeSql(op.sql);
	assert(/delete from "?regular_expressions"?/i.test(sql));
	assert(!sql.includes('regular_expression_tags'));
});

test('regex with tags deletes tag links before the regex', async () => {
	const ctx = await seededPcd('with-tags', [
		base.regex({ name: 'Tagged Delete Regex', pattern: '\\bdelete\\b', tags: ['A', 'B'] })
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.remove(ctx, 1);

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = ops[0];
	assertEquals(parseDesiredState(op).tags, ['A', 'B']);
	const sql = normalizeSql(op.sql);
	const lowerSql = sql.toLowerCase();
	const tagDeleteIndex = lowerSql.indexOf('delete from regular_expression_tags');
	const regexDeleteIndex = lowerSql.indexOf('delete from "regular_expressions"');
	assert(tagDeleteIndex >= 0);
	assert(regexDeleteIndex >= 0);
	assert(tagDeleteIndex < regexDeleteIndex);
});

test('referenced regex is blocked when referenced deletes fail', async () => {
	const ctx = await seededPcd('referenced-blocked', [
		base.regex({ name: 'Referenced Regex', pattern: '\\breferenced\\b' }),
		base.customFormatRegexCondition({
			formatName: 'Format One',
			conditionName: 'Release Title',
			regexName: 'Referenced Regex'
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.regex.submitRemove(ctx, 1);

	await assertActionFailed(response);
	assertEquals(userOpsSince(ctx, checkpoint).length, 0);
});

test('referenced regex can remove dependent conditions when allowed', async () => {
	const ctx = await seededPcd('referenced-allowed', [
		base.regex({ name: 'Referenced Regex', pattern: '\\breferenced\\b' }),
		base.customFormatRegexCondition({
			formatName: 'Format One',
			conditionName: 'Release Title',
			regexName: 'Referenced Regex'
		})
	]);
	setFailOnReferencedDelete(ctx, false);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.remove(ctx, 1);

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 2);
	const generatedOp = generatedCustomFormatOp(ops);
	const deleteOp = ops.find((op) => parseMetadata(op).operation === 'delete');
	assertExists(deleteOp);
	assertSameGroup([generatedOp, deleteOp]);
	assertEquals(parseMetadata(generatedOp).changed_fields, ['conditions']);
	assertEquals(
		(parseDesiredState(generatedOp).conditions as JsonObject).removed instanceof Array,
		true
	);
});

await run();
