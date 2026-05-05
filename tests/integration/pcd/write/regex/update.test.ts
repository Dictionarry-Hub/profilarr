/**
 * PCD write tests: regex update.
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { base } from '../../harness/fixtures.ts';
import { normalizeSql, opCheckpoint, parseDesiredState } from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import {
	assertOnlyField,
	assertSameGroup,
	createScenarioFactory,
	opForChangedField,
	userOpsSince
} from './helpers.ts';

const PORT = 7038;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-regex-update');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

test('scalar fields split into independent grouped ops', async () => {
	const ctx = await seededPcd('scalars', [
		base.regex({
			name: 'Scalar Regex',
			pattern: '\\bold\\b',
			description: 'Old',
			regex101Id: 'old101'
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.update(ctx, 1, {
		name: 'Scalar Regex',
		pattern: '\\bnew\\b',
		description: 'New description',
		regex101Id: 'new101'
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 3);
	assertOnlyField(ops, 'pattern');
	assertOnlyField(ops, 'description');
	assertOnlyField(ops, 'regex101_id');
	assertSameGroup(ops);
});

test('clearing nullable scalar fields writes null desired state', async () => {
	const ctx = await seededPcd('null-scalars', [
		base.regex({
			name: 'Nullable Regex',
			pattern: '\\bnullable\\b',
			description: 'Old',
			regex101Id: 'old101'
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.update(ctx, 1, {
		name: 'Nullable Regex',
		pattern: '\\bnullable\\b',
		description: '',
		regex101Id: ''
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 2);
	assertEquals(parseDesiredState(opForChangedField(ops, 'description')).description, {
		from: 'Old',
		to: null
	});
	assertEquals(parseDesiredState(opForChangedField(ops, 'regex101_id')).regex101_id, {
		from: 'old101',
		to: null
	});
});

test('tags add and remove in one tags op', async () => {
	const ctx = await seededPcd('tags', [
		base.regex({
			name: 'Tagged Regex',
			pattern: '\\btagged\\b',
			tags: ['Old', 'Keep']
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.update(ctx, 1, {
		name: 'Tagged Regex',
		pattern: '\\btagged\\b',
		tags: ['Keep', 'New']
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = opForChangedField(ops, 'tags');
	assertEquals(parseDesiredState(op).tags, { add: ['New'], remove: ['Old'] });
	const sql = normalizeSql(op.sql);
	assert(sql.includes('DELETE FROM regular_expression_tags'));
	assert(sql.includes(`'Tagged Regex', 'New'`));
});

test('unchanged fields and tag reorder write no ops', async () => {
	const ctx = await seededPcd('noop', [
		base.regex({
			name: 'Noop Regex',
			pattern: '\\bnoop\\b',
			description: 'Same',
			regex101Id: 'same101',
			tags: ['A', 'B']
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.update(ctx, 1, {
		name: 'Noop Regex',
		pattern: '\\bnoop\\b',
		description: 'Same',
		regex101Id: 'same101',
		tags: ['B', 'A']
	});

	assertEquals(userOpsSince(ctx, checkpoint).length, 0);
});

await run();
