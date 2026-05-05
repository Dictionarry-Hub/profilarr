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

/**
 * Context
 *   Base layer seeded with one regex via base.regex():
 *     name='Scalar Regex', pattern='\bold\b', description='Old', regex101Id='old101'
 *   Compiled.
 *
 * Submit
 *   POST /regular-expressions/{ctx.dbId}/1?/update with form fields:
 *     name        = 'Scalar Regex'         // unchanged
 *     pattern     = '\bnew\b'              // changed
 *     description = 'New description'      // changed
 *     regex101Id  = 'new101'               // changed
 *     tags        = '[]'
 *     layer       = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 3
 *   - one op with metadata.changed_fields === ['pattern']
 *   - one op with metadata.changed_fields === ['description']
 *   - one op with metadata.changed_fields === ['regex101_id']
 *   - all three ops share the same metadata.group_id
 *   - each op's SQL only mentions its own column
 */
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

/**
 * Context
 *   Base layer seeded with one regex via base.regex():
 *     name='Nullable Regex', pattern='\bnullable\b', description='Old', regex101Id='old101'
 *   Compiled.
 *
 * Submit
 *   POST /regular-expressions/{ctx.dbId}/1?/update with form fields:
 *     name        = 'Nullable Regex'   // unchanged
 *     pattern     = '\bnullable\b'     // unchanged
 *     description = ''                 // cleared
 *     regex101Id  = ''                 // cleared
 *     tags        = '[]'
 *     layer       = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 2
 *   - description op desired_state.description === { from: 'Old',    to: null }
 *   - regex101_id op desired_state.regex101_id === { from: 'old101', to: null }
 */
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

/**
 * Context
 *   Base layer seeded with one regex via base.regex():
 *     name='Tagged Regex', pattern='\btagged\b', tags=['Old', 'Keep']
 *   Compiled.
 *
 * Submit
 *   POST /regular-expressions/{ctx.dbId}/1?/update with form fields:
 *     name        = 'Tagged Regex'       // unchanged
 *     pattern     = '\btagged\b'         // unchanged
 *     description = ''
 *     regex101Id  = ''
 *     tags        = '["Keep","New"]'     // drops 'Old', adds 'New'
 *     layer       = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op with metadata.changed_fields === ['tags']
 *   - op.desired_state.tags === { add: ['New'], remove: ['Old'] }
 *   - op.sql contains 'DELETE FROM regular_expression_tags'
 *   - op.sql contains "'Tagged Regex', 'New'"
 */
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

/**
 * Context
 *   Base layer seeded with one regex via base.regex():
 *     name='Noop Regex', pattern='\bnoop\b', description='Same',
 *     regex101Id='same101', tags=['A', 'B']
 *   Compiled.
 *
 * Submit
 *   POST /regular-expressions/{ctx.dbId}/1?/update with form fields:
 *     name        = 'Noop Regex'      // unchanged
 *     pattern     = '\bnoop\b'        // unchanged
 *     description = 'Same'            // unchanged
 *     regex101Id  = 'same101'         // unchanged
 *     tags        = '["B","A"]'       // same set, different order
 *     layer       = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 0
 *
 * Note: tag order is not tracked, so reordering alone is not a change.
 */
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
