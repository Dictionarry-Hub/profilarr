/**
 * PCD write tests: regex rename.
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { base } from '../../harness/fixtures.ts';
import { normalizeSql, opCheckpoint, parseDesiredState, parseMetadata } from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import {
	assertActionFailed,
	assertOnlyField,
	assertSameGroup,
	createScenarioFactory,
	generatedCustomFormatOp,
	opForChangedField,
	userOpsSince
} from './helpers.ts';

const PORT = 7039;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-regex-rename');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

test('unreferenced regex emits one rename op', async () => {
	const ctx = await seededPcd('simple', [base.regex({ name: 'Old Regex', pattern: '\\bold\\b' })]);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.update(ctx, 1, {
		name: 'New Regex',
		pattern: '\\bold\\b'
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = opForChangedField(ops, 'name');
	const metadata = parseMetadata(op);
	assertEquals(metadata.name, 'New Regex');
	assertEquals(metadata.previousName, 'Old Regex');
	assertEquals(metadata.group_id, undefined);
	assertEquals(parseDesiredState(op).name, { from: 'Old Regex', to: 'New Regex' });
});

test('rename plus pattern change emits grouped split ops', async () => {
	const ctx = await seededPcd('with-pattern', [
		base.regex({ name: 'Old Regex', pattern: '\\bold\\b' })
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.update(ctx, 1, {
		name: 'New Regex',
		pattern: '\\bnew\\b'
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 2);
	assertOnlyField(ops, 'pattern');
	assertOnlyField(ops, 'name');
	assertSameGroup(ops);
});

test('referenced regex emits generated custom format cascade op', async () => {
	const ctx = await seededPcd('cascade', [
		base.regex({ name: 'Referenced Regex', pattern: '\\breferenced\\b' }),
		base.customFormatRegexCondition({
			formatName: 'Format One',
			conditionName: 'Release Title',
			regexName: 'Referenced Regex'
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.update(ctx, 1, {
		name: 'Renamed Regex',
		pattern: '\\breferenced\\b'
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 2);
	const renameOp = opForChangedField(ops, 'name');
	const generatedOp = generatedCustomFormatOp(ops);
	assertSameGroup([renameOp, generatedOp]);
	assertEquals(parseMetadata(generatedOp).depends_on, [
		{ entity: 'regular_expression', key: 'regular_expression_name', value: 'Renamed Regex' }
	]);
	assert(normalizeSql(generatedOp.sql).includes('condition_patterns'));
});

test('duplicate name fails without writing ops', async () => {
	const ctx = await seededPcd('duplicate', [
		base.regex({ name: 'First Regex', pattern: '\\bfirst\\b' }),
		base.regex({ name: 'Second Regex', pattern: '\\bsecond\\b' })
	]);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.regex.submitUpdate(ctx, 1, {
		name: 'second regex',
		pattern: '\\bfirst\\b'
	});

	await assertActionFailed(response);
	assertEquals(userOpsSince(ctx, checkpoint).length, 0);
});

await run();
