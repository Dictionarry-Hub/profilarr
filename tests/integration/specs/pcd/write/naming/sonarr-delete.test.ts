/**
 * PCD write tests: sonarr naming delete.
 *
 * The name-only-guard SQL assertion will fail until the delete writer drops
 * its non-name guards (covered by task #10). It pins the desired contract
 * before the implementation.
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

const PORT = PORTS.pcd.writeNamingSonarrDelete;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-naming-sonarr-delete');

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

afterAll(async () => {
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
	expect(ops.length).toStrictEqual(1);
	const op = ops[0];
	const metadata = parseMetadata(op);
	expect(metadata.operation).toStrictEqual('delete');
	expect(metadata.entity).toStrictEqual('sonarr_naming');
	expect(metadata.name).toStrictEqual('Delete Naming');
	expect(metadata.changed_fields).toStrictEqual(['deleted']);
	const desired = parseDesiredState(op);
	expect(desired.deleted).toStrictEqual(true);
	expect(desired.name).toStrictEqual('Delete Naming');
	expect(desired.standard_episode_format).toStrictEqual('{Series Title}');
	expect(desired.custom_colon_replacement_format).toStrictEqual(' - ');
	expect(desired.multi_episode_style).toStrictEqual('range');

	const sql = normalizeSql(op.sql);
	const lowerSql = sql.toLowerCase();
	expect(/delete from "?sonarr_naming"?/i.test(sql)).toBeTruthy();

	const deleteIndex = lowerSql.indexOf('delete from "sonarr_naming"');
	expect(deleteIndex >= 0, 'expected sonarr_naming delete in SQL').toBeTruthy();
	const deleteClause = sql.slice(deleteIndex);
	expect(/where "?name"? = /i.test(deleteClause)).toBeTruthy();

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
		expect(
			!pattern.test(deleteClause),
			`${field} should not appear in delete WHERE clause, got: ${deleteClause}`
		).toBeTruthy();
	}
});
