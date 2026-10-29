/**
 * PCD write tests: radarr naming delete.
 *
 * The name-only-guard SQL assertion will fail until the delete writer drops
 * its non-name guards (covered by task #10). It pins the desired contract
 * before the implementation, mirroring the regex / delay-profile / media-settings
 * pattern.
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
import { createScenarioFactory, userOpsSince } from './helpers.ts';

const PORT = PORTS.pcd.writeNamingRadarrDelete;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-naming-radarr-delete');

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

afterAll(async () => {
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
	expect(ops.length).toStrictEqual(1);
	const op = ops[0];
	const metadata = parseMetadata(op);
	expect(metadata.operation).toStrictEqual('delete');
	expect(metadata.entity).toStrictEqual('radarr_naming');
	expect(metadata.name).toStrictEqual('Delete Naming');
	expect(metadata.changed_fields).toStrictEqual(['deleted']);
	const desired = parseDesiredState(op);
	expect(desired.deleted).toStrictEqual(true);
	expect(desired.name).toStrictEqual('Delete Naming');
	expect(desired.movie_format).toStrictEqual('{Movie Title} ({Release Year})');
	expect(desired.colon_replacement_format).toStrictEqual('dash');

	const sql = normalizeSql(op.sql);
	const lowerSql = sql.toLowerCase();
	expect(/delete from "?radarr_naming"?/i.test(sql)).toBeTruthy();

	const deleteIndex = lowerSql.indexOf('delete from "radarr_naming"');
	expect(deleteIndex >= 0, 'expected radarr_naming delete in SQL').toBeTruthy();
	const deleteClause = sql.slice(deleteIndex);
	expect(/where "?name"? = /i.test(deleteClause)).toBeTruthy();
	expect(
		!/where[^;]*"?rename"?\s*=/i.test(deleteClause),
		`rename should not appear in delete WHERE clause, got: ${deleteClause}`
	).toBeTruthy();
	expect(
		!/where[^;]*"?movie_format"?\s*=/i.test(deleteClause),
		`movie_format should not appear in delete WHERE clause, got: ${deleteClause}`
	).toBeTruthy();
	expect(
		!/where[^;]*"?movie_folder_format"?\s*=/i.test(deleteClause),
		`movie_folder_format should not appear in delete WHERE clause, got: ${deleteClause}`
	).toBeTruthy();
	expect(
		!/where[^;]*"?replace_illegal_characters"?\s*=/i.test(deleteClause),
		`replace_illegal_characters should not appear in delete WHERE clause, got: ${deleteClause}`
	).toBeTruthy();
	expect(
		!/where[^;]*"?colon_replacement_format"?\s*=/i.test(deleteClause),
		`colon_replacement_format should not appear in delete WHERE clause, got: ${deleteClause}`
	).toBeTruthy();
});
