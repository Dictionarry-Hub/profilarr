/**
 * PCD write tests: regular expression form actions.
 */

import { assert, assertEquals, assertExists } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { base } from '../harness/fixtures.ts';
import {
	compilePcd,
	normalizeSql,
	opCheckpoint,
	parseDesiredState,
	parseMetadata,
	queryOpsSince,
	seedBase,
	setupPcd,
	type JsonObject,
	type OpRow,
	type PcdTestContext
} from '../harness/pcd.ts';
import { write } from '../harness/write.ts';

const PORT = 7035;
const ORIGIN = `http://localhost:${PORT}`;

let ctx: PcdTestContext;
let userOps: OpRow[];

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');

	ctx = await setupPcd({
		port: PORT,
		name: 'pcd-write-regex',
		conflictStrategy: 'ask'
	});

	seedBase(ctx, [
		base.regex({
			name: 'TestRegex',
			pattern: '\\bold\\b',
			description: 'Old'
		})
	]);

	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.update(ctx, 1, {
		name: 'TestRegex',
		pattern: '\\bnew\\b',
		description: 'New description'
	});

	userOps = queryOpsSince(ctx, checkpoint, {
		origin: 'user',
		state: 'published'
	});
});

teardown(async () => {
	await stopServer(PORT);
});

test('regex update emits one user op per changed field', () => {
	assertEquals(userOps.length, 2);
	assertExists(opForChangedField('pattern'));
	assertExists(opForChangedField('description'));
});

test('description op only updates description', () => {
	const op = opForChangedField('description');
	const sql = normalizeSql(op.sql);
	assert(/set\s+"description"/i.test(sql), `Description op should set description, got: ${sql}`);
	assert(!/set\s+"pattern"/i.test(sql), `Description op should not set pattern, got: ${sql}`);
});

test('pattern op only updates pattern', () => {
	const op = opForChangedField('pattern');
	const sql = normalizeSql(op.sql);
	assert(/set\s+"pattern"/i.test(sql), `Pattern op should set pattern, got: ${sql}`);
	assert(!/set\s+"description"/i.test(sql), `Pattern op should not set description, got: ${sql}`);
});

test('split ops share one group id', () => {
	const groupIds = userOps.map((op) => parseMetadata(op).group_id);
	assertEquals(groupIds.length, 2);
	assertExists(groupIds[0]);
	assertEquals(groupIds[0], groupIds[1]);
});

test('split ops carry single-field desired state', () => {
	for (const op of userOps) {
		const fields = changedFields(op);
		assertEquals(fields.length, 1);
		const desired = parseDesiredState(op);
		const entry = desired[fields[0]] as JsonObject | undefined;
		assertExists(entry, `Expected desired state for ${fields[0]}`);
		assert('from' in entry, `Expected desired state for ${fields[0]} to include from`);
		assert('to' in entry, `Expected desired state for ${fields[0]} to include to`);
	}
});

function opForChangedField(field: string): OpRow {
	const op = userOps.find((candidate) => {
		const fields = changedFields(candidate);
		return fields.length === 1 && fields[0] === field;
	});
	assertExists(op, `Expected a user op for ${field}`);
	return op;
}

function changedFields(op: OpRow): string[] {
	const fields = parseMetadata(op).changed_fields;
	if (!Array.isArray(fields)) return [];
	return fields.filter((field): field is string => typeof field === 'string');
}

await run();
