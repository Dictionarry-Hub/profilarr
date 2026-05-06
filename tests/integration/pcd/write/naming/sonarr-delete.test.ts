/**
 * PCD write tests: sonarr naming delete.
 *
 * The name-only-guard SQL assertion will fail until the delete writer drops
 * its non-name guards (covered by task #10). It pins the desired contract
 * before the implementation.
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import { normalizeSql, opCheckpoint, parseDesiredState, parseMetadata } from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import { createScenarioFactory, userOpsSince } from './helpers.ts';

const PORT = PORTS.pcd.writeNamingSonarrDelete;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-naming-sonarr-delete');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Base layer seeded with one row:
 *     name='Delete Naming', rename=false, every episode/folder format set,
 *     replaceIllegalCharacters=true, colonReplacementFormat='custom',
 *     customColonReplacementFormat=' - ', multiEpisodeStyle='range'
 *   Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/sonarr/Delete%20Naming?/delete
 *     with form fields: layer = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.operation       === 'delete'
 *   - op.metadata.entity          === 'sonarr_naming'
 *   - op.metadata.name            === 'Delete Naming'
 *   - op.metadata.changed_fields  === ['deleted']
 *   - op.desired_state.deleted                          === true
 *   - op.desired_state.name                             === 'Delete Naming'
 *   - op.desired_state.standard_episode_format          === '{Series Title}'
 *   - op.desired_state.custom_colon_replacement_format  === ' - '
 *   - op.desired_state.multi_episode_style              === 'range'
 *   - op.sql matches /delete from "?sonarr_naming"?/i
 *   - op.sql DELETE clause guards by name only (no episode/folder formats,
 *     rename, replace_illegal_characters, colon_replacement_format,
 *     custom_colon_replacement_format, or multi_episode_style in the WHERE).
 *     Currently fails until the delete writer drops its non-name guards (#10).
 */
test('sonarr naming delete emits one name-guarded op', async () => {
	const ctx = await seededPcd('simple', [
		base.sonarrNaming({
			name: 'Delete Naming',
			rename: false,
			standardEpisodeFormat: '{Series Title}',
			dailyEpisodeFormat: '{Series Title}',
			animeEpisodeFormat: '{Series Title}',
			seriesFolderFormat: '{Series Title}',
			seasonFolderFormat: 'Season {season}',
			replaceIllegalCharacters: true,
			colonReplacementFormat: 'custom',
			customColonReplacementFormat: ' - ',
			multiEpisodeStyle: 'range'
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.namingSonarr.remove(ctx, 'Delete Naming');

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = ops[0];
	const metadata = parseMetadata(op);
	assertEquals(metadata.operation, 'delete');
	assertEquals(metadata.entity, 'sonarr_naming');
	assertEquals(metadata.name, 'Delete Naming');
	assertEquals(metadata.changed_fields, ['deleted']);
	const desired = parseDesiredState(op);
	assertEquals(desired.deleted, true);
	assertEquals(desired.name, 'Delete Naming');
	assertEquals(desired.standard_episode_format, '{Series Title}');
	assertEquals(desired.custom_colon_replacement_format, ' - ');
	assertEquals(desired.multi_episode_style, 'range');

	const sql = normalizeSql(op.sql);
	const lowerSql = sql.toLowerCase();
	assert(/delete from "?sonarr_naming"?/i.test(sql));

	const deleteIndex = lowerSql.indexOf('delete from "sonarr_naming"');
	assert(deleteIndex >= 0, 'expected sonarr_naming delete in SQL');
	const deleteClause = sql.slice(deleteIndex);
	assert(/where "?name"? = /i.test(deleteClause));

	const forbidden = [
		'rename',
		'standard_episode_format',
		'daily_episode_format',
		'anime_episode_format',
		'series_folder_format',
		'season_folder_format',
		'replace_illegal_characters',
		'colon_replacement_format',
		'custom_colon_replacement_format',
		'multi_episode_style'
	];
	for (const field of forbidden) {
		const pattern = new RegExp(`where[^;]*"?${field}"?\\s*=`, 'i');
		assert(
			!pattern.test(deleteClause),
			`${field} should not appear in delete WHERE clause, got: ${deleteClause}`
		);
	}
});

await run();
