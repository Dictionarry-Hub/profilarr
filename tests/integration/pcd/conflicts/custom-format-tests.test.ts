/**
 * PCD conflict tests: custom format tests.
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { openDb } from '$test-harness/db.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../harness/fixtures.ts';
import { compilePcd, opCheckpoint, queryOpsSince, seedBase, setupPcd } from '../harness/pcd.ts';

const PORT = PORTS.pcd.conflictsCustomFormatTests;
const ORIGIN = `http://localhost:${PORT}`;
const FORMAT_NAME = 'x265';
const READ_ONLY_MESSAGE = 'Entity tests are read-only for this database';

let counter = 0;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Migrates old 1.8.
 *
 * Context
 *   Local-ops PCD without a personal access token.
 *   Base layer has one custom format:
 *     name='x265'
 *
 * User
 *   POST create custom format test:
 *     title='Read-only test'
 *
 * Expect
 *   - create action fails with the read-only entity-test guard
 *   - no user op is written
 *   - compiled cache has no custom format tests
 */
test('read-only database blocks custom format test creation', async () => {
	const ctx = await setupPcd({
		port: PORT,
		name: `pcd-conflict-custom-format-tests-${++counter}`,
		conflictStrategy: 'ask'
	});
	seedBase(ctx, [base.customFormat({ name: FORMAT_NAME })]);
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	const response = await ctx.client.postForm(
		`/custom-formats/${ctx.dbId}/1/testing/new`,
		{
			title: 'Read-only test',
			type: 'movie',
			shouldMatch: '1',
			description: '',
			formatName: FORMAT_NAME,
			layer: 'user'
		},
		{ headers: { Origin: ctx.origin } }
	);
	const body = await response.text();

	assertEquals(formActionStatus(response, body), 403);
	assertStringIncludes(body, READ_ONLY_MESSAGE);
	assertEquals(queryOpsSince(ctx, checkpoint, { origin: 'user' }), []);
	assertEquals(compiledTestCount(ctx.dbPath, ctx.dbId), 0);
});

function formActionStatus(response: Response, body: string): number {
	try {
		const parsed = JSON.parse(body) as { status?: number };
		return parsed.status ?? response.status;
	} catch {
		return response.status;
	}
}

function compiledTestCount(dbPath: string, databaseId: number): number {
	const source = openDb(dbPath);
	const replay = openDb(':memory:');
	try {
		replay.exec('PRAGMA foreign_keys = ON');
		replay.exec(Deno.readTextFileSync('docs/backend/0.schema.sql'));

		const ops = source
			.prepare(
				`SELECT sql
				 FROM pcd_ops
				 WHERE database_id = ?
				   AND state = 'published'
				 ORDER BY CASE origin WHEN 'base' THEN 0 ELSE 1 END, COALESCE(sequence, id), id`
			)
			.all(databaseId) as Array<{ sql: string }>;

		for (const op of ops) {
			replay.exec(op.sql);
		}

		const row = replay.prepare('SELECT COUNT(*) AS count FROM custom_format_tests').get() as {
			count: number;
		};
		return row.count;
	} finally {
		replay.close();
		source.close();
	}
}

await run();
