/**
 * PCD write tests: radarr naming delete.
 *
 * The name-only-guard SQL assertion will fail until the delete writer drops
 * its non-name guards (covered by task #10). It pins the desired contract
 * before the implementation, mirroring the regex / delay-profile / media-settings
 * pattern.
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import { normalizeSql, opCheckpoint, parseDesiredState, parseMetadata } from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import { createScenarioFactory, userOpsSince } from './helpers.ts';

const PORT = PORTS.pcd.writeNamingRadarrDelete;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-naming-radarr-delete');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Base layer seeded with one row:
 *     name='Delete Naming', rename=false, movieFormat='{Movie Title} ({Release Year})',
 *     movieFolderFormat='{Movie Title}', replaceIllegalCharacters=true,
 *     colonReplacementFormat='dash'
 *   Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/radarr/Delete%20Naming?/delete
 *     with form fields: layer = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.operation       === 'delete'
 *   - op.metadata.entity          === 'radarr_naming'
 *   - op.metadata.name            === 'Delete Naming'
 *   - op.metadata.changed_fields  === ['deleted']
 *   - op.desired_state.deleted                       === true
 *   - op.desired_state.name                          === 'Delete Naming'
 *   - op.desired_state.movie_format                  === '{Movie Title} ({Release Year})'
 *   - op.desired_state.colon_replacement_format      === 'dash'
 *   - op.sql matches /delete from "?radarr_naming"?/i
 *   - op.sql DELETE clause guards by name only (no rename, movie_format,
 *     movie_folder_format, replace_illegal_characters, or colon_replacement_format
 *     in the WHERE). Currently fails until the delete writer drops its non-name
 *     guards (#10).
 */
test('radarr naming delete emits one name-guarded op', async () => {
	const ctx = await seededPcd('simple', [
		base.radarrNaming({
			name: 'Delete Naming',
			rename: false,
			movieFormat: '{Movie Title} ({Release Year})',
			movieFolderFormat: '{Movie Title}',
			replaceIllegalCharacters: true,
			colonReplacementFormat: 'dash'
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.namingRadarr.remove(ctx, 'Delete Naming');

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = ops[0];
	const metadata = parseMetadata(op);
	assertEquals(metadata.operation, 'delete');
	assertEquals(metadata.entity, 'radarr_naming');
	assertEquals(metadata.name, 'Delete Naming');
	assertEquals(metadata.changed_fields, ['deleted']);
	const desired = parseDesiredState(op);
	assertEquals(desired.deleted, true);
	assertEquals(desired.name, 'Delete Naming');
	assertEquals(desired.movie_format, '{Movie Title} ({Release Year})');
	assertEquals(desired.colon_replacement_format, 'dash');

	const sql = normalizeSql(op.sql);
	const lowerSql = sql.toLowerCase();
	assert(/delete from "?radarr_naming"?/i.test(sql));

	const deleteIndex = lowerSql.indexOf('delete from "radarr_naming"');
	assert(deleteIndex >= 0, 'expected radarr_naming delete in SQL');
	const deleteClause = sql.slice(deleteIndex);
	assert(/where "?name"? = /i.test(deleteClause));
	assert(
		!/where[^;]*"?rename"?\s*=/i.test(deleteClause),
		`rename should not appear in delete WHERE clause, got: ${deleteClause}`
	);
	assert(
		!/where[^;]*"?movie_format"?\s*=/i.test(deleteClause),
		`movie_format should not appear in delete WHERE clause, got: ${deleteClause}`
	);
	assert(
		!/where[^;]*"?movie_folder_format"?\s*=/i.test(deleteClause),
		`movie_folder_format should not appear in delete WHERE clause, got: ${deleteClause}`
	);
	assert(
		!/where[^;]*"?replace_illegal_characters"?\s*=/i.test(deleteClause),
		`replace_illegal_characters should not appear in delete WHERE clause, got: ${deleteClause}`
	);
	assert(
		!/where[^;]*"?colon_replacement_format"?\s*=/i.test(deleteClause),
		`colon_replacement_format should not appear in delete WHERE clause, got: ${deleteClause}`
	);
});

await run();
