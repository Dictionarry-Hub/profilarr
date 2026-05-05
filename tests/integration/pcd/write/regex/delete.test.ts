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

/**
 * Context
 *   Base layer seeded with one regex via base.regex():
 *     name='Delete Regex', pattern='\bdelete\b'
 *   No tags, no referencing custom format conditions. Compiled.
 *
 * Submit
 *   POST /regular-expressions/{ctx.dbId}/1?/delete with form fields:
 *     layer = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.operation     === 'delete'
 *   - op.metadata.changed_fields === ['deleted']
 *   - op.desired_state.deleted  === true
 *   - op.sql matches /delete from "?regular_expressions"?/i
 *   - op.sql does NOT contain 'regular_expression_tags'
 */
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

/**
 * Context
 *   Base layer seeded with one regex via base.regex():
 *     name='Tagged Delete Regex', pattern='\bdelete\b', tags=['A','B']
 *   Compiled.
 *
 * Submit
 *   POST /regular-expressions/{ctx.dbId}/1?/delete with form fields:
 *     layer = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.desired_state.tags === ['A','B']
 *   - op.sql contains 'DELETE FROM regular_expression_tags'
 *   - op.sql contains 'DELETE FROM "regular_expressions"'
 *   - tag-link delete appears before the regex delete in the SQL
 */
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

/**
 * Context
 *   Base layer seeded with:
 *     - regex { name='Referenced Regex', pattern='\breferenced\b' }
 *     - custom format 'Format One' with condition 'Release Title'
 *       referencing 'Referenced Regex' via condition_patterns
 *   general_settings.fail_on_referenced_delete = 1 (default). Compiled.
 *
 * Submit
 *   POST /regular-expressions/{ctx.dbId}/1?/delete with form fields:
 *     layer = 'user'
 *
 * Expect
 *   - response.status >= 400 OR body contains '"type":"failure"'
 *   - userOpsSince(checkpoint).length === 0
 */
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

/**
 * Context
 *   Base layer seeded with:
 *     - regex { name='Referenced Regex', pattern='\breferenced\b' }
 *     - custom format 'Format One' with condition 'Release Title'
 *       referencing 'Referenced Regex' via condition_patterns
 *   setFailOnReferencedDelete(ctx, false) flips
 *   general_settings.fail_on_referenced_delete to 0. Compiled.
 *
 * Submit
 *   POST /regular-expressions/{ctx.dbId}/1?/delete with form fields:
 *     layer = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 2
 *   - one op with metadata.operation === 'delete' (the regex itself)
 *   - one op with metadata.entity === 'custom_format' and
 *                metadata.generated === true (the cascade)
 *   - both ops share the same metadata.group_id
 *   - cascade op.metadata.changed_fields === ['conditions']
 *   - cascade op.desired_state.conditions.removed is an Array
 */
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
