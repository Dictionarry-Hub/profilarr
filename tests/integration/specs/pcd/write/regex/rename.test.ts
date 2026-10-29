/**
 * PCD write tests: regex rename.
 */

import { startServer, stopServer } from '#integration/harness/server.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { base } from '#integration/specs/pcd/harness/fixtures.ts';
import {
	normalizeSql,
	opCheckpoint,
	parseDesiredState,
	parseMetadata
} from '#integration/specs/pcd/harness/pcd.ts';
import { write } from '#integration/specs/pcd/harness/write.ts';
import {
	assertActionFailed,
	assertOnlyField,
	assertSameGroup,
	createScenarioFactory,
	generatedCustomFormatOp,
	opForChangedField,
	userOpsSince
} from './helpers.ts';

const PORT = PORTS.pcd.writeRegexRename;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-regex-rename');

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

afterAll(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Base layer seeded with one regex via base.regex():
 *     name='Old Regex', pattern='\bold\b'
 *   No custom format conditions reference this regex. Compiled.
 *
 * Submit
 *   POST /regular-expressions/{ctx.dbId}/1?/update with form fields:
 *     name        = 'New Regex'    // changed
 *     pattern     = '\bold\b'      // unchanged
 *     description = ''
 *     regex101Id  = ''
 *     tags        = '[]'
 *     layer       = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op with metadata.changed_fields === ['name']
 *   - op.metadata.name         === 'New Regex'
 *   - op.metadata.previousName === 'Old Regex'
 *   - op.metadata.group_id     === undefined   // lone op, no cascade
 *   - op.desired_state.name    === { from: 'Old Regex', to: 'New Regex' }
 */
test('unreferenced regex emits one rename op', async () => {
	const ctx = await seededPcd('simple', [base.regex({ name: 'Old Regex', pattern: '\\bold\\b' })]);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.update(ctx, 1, {
		name: 'New Regex',
		pattern: '\\bold\\b'
	});

	const ops = userOpsSince(ctx, checkpoint);
	expect(ops.length).toStrictEqual(1);
	const op = opForChangedField(ops, 'name');
	const metadata = parseMetadata(op);
	expect(metadata.name).toStrictEqual('New Regex');
	expect(metadata.previousName).toStrictEqual('Old Regex');
	expect(metadata.group_id).toStrictEqual(undefined);
	expect(parseDesiredState(op).name).toStrictEqual({ from: 'Old Regex', to: 'New Regex' });
});

/**
 * Context
 *   Base layer seeded with one regex via base.regex():
 *     name='Old Regex', pattern='\bold\b'
 *   Compiled.
 *
 * Submit
 *   POST /regular-expressions/{ctx.dbId}/1?/update with form fields:
 *     name        = 'New Regex'    // changed
 *     pattern     = '\bnew\b'      // changed
 *     description = ''
 *     regex101Id  = ''
 *     tags        = '[]'
 *     layer       = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 2
 *   - one op with metadata.changed_fields === ['pattern']
 *   - one op with metadata.changed_fields === ['name']
 *   - both ops share the same metadata.group_id
 */
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
	expect(ops.length).toStrictEqual(2);
	assertOnlyField(ops, 'pattern');
	assertOnlyField(ops, 'name');
	assertSameGroup(ops);
});

/**
 * Context
 *   Base layer seeded with:
 *     - regex { name='Referenced Regex', pattern='\breferenced\b' }
 *     - custom format 'Format One' with condition 'Release Title'
 *       referencing 'Referenced Regex' via condition_patterns
 *   Compiled.
 *
 * Submit
 *   POST /regular-expressions/{ctx.dbId}/1?/update with form fields:
 *     name        = 'Renamed Regex'        // changed
 *     pattern     = '\breferenced\b'       // unchanged
 *     description = ''
 *     regex101Id  = ''
 *     tags        = '[]'
 *     layer       = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 2
 *   - one rename op with metadata.changed_fields === ['name']
 *   - one cascade op with metadata.entity === 'custom_format' and
 *                       metadata.generated === true
 *   - both ops share the same metadata.group_id
 *   - cascade op.metadata.depends_on === [{
 *       entity: 'regular_expression',
 *       key:    'regular_expression_name',
 *       value:  'Renamed Regex'
 *     }]
 *   - cascade op.sql contains 'condition_patterns'
 */
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
	expect(ops.length).toStrictEqual(2);
	const renameOp = opForChangedField(ops, 'name');
	const generatedOp = generatedCustomFormatOp(ops);
	assertSameGroup([renameOp, generatedOp]);
	expect(parseMetadata(generatedOp).depends_on).toStrictEqual([
		{ entity: 'regular_expression', key: 'regular_expression_name', value: 'Renamed Regex' }
	]);
	expect(normalizeSql(generatedOp.sql).includes('condition_patterns')).toBeTruthy();
});

/**
 * Context
 *   Base layer seeded with two regexes via base.regex():
 *     - { name='First Regex',  pattern='\bfirst\b' }
 *     - { name='Second Regex', pattern='\bsecond\b' }
 *   Compiled.
 *
 * Submit
 *   POST /regular-expressions/{ctx.dbId}/1?/update with form fields:
 *     name        = 'second regex'   // lowercase clash with 'Second Regex'
 *     pattern     = '\bfirst\b'      // unchanged
 *     description = ''
 *     regex101Id  = ''
 *     tags        = '[]'
 *     layer       = 'user'
 *
 * Expect
 *   - response.status >= 400 OR body contains '"type":"failure"'
 *   - userOpsSince(checkpoint).length === 0
 */
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
	expect(userOpsSince(ctx, checkpoint).length).toStrictEqual(0);
});
