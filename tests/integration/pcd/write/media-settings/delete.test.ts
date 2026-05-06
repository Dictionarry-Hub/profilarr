/**
 * PCD write tests: media settings delete (radarr + sonarr).
 *
 * The name-only-guard SQL assertion will fail until the delete writer drops
 * its non-name guards (covered by task #5). It pins the desired contract
 * before the implementation, mirroring the regex / delay-profile pattern.
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import { normalizeSql, opCheckpoint, parseDesiredState, parseMetadata } from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import {
	createScenarioFactory,
	entityForArrType,
	MEDIA_SETTINGS_ARR_TYPES,
	tableForArrType,
	userOpsSince
} from './helpers.ts';

const PORT = PORTS.pcd.writeMediaSettingsDelete;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-media-settings-delete');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

function seedFor(
	arrType: 'radarr' | 'sonarr',
	input: Parameters<typeof base.radarrMediaSettings>[0]
) {
	return arrType === 'radarr' ? base.radarrMediaSettings(input) : base.sonarrMediaSettings(input);
}

/**
 * Context (per arr-type)
 *   Base layer seeded with one row:
 *     name='Delete Media', propersRepacks='preferAndUpgrade', enableMediaInfo=true
 *   Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/media-settings/{arrType}/Delete%20Media?/delete
 *     with form fields:
 *       layer = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.operation       === 'delete'
 *   - op.metadata.entity          === '<arr>_media_settings'
 *   - op.metadata.name            === 'Delete Media'
 *   - op.metadata.changed_fields  === ['deleted']
 *   - op.desired_state.deleted    === true
 *   - op.desired_state.name       === 'Delete Media'
 *   - op.desired_state.propers_repacks === 'preferAndUpgrade'
 *   - op.desired_state.enable_media_info === true
 *   - op.sql matches /delete from "?<arr>_media_settings"?/i
 *   - op.sql DELETE clause guards by name only (no propers_repacks /
 *     enable_media_info in the WHERE clause). Currently fails until the
 *     delete writer drops its non-name guards (#5).
 */
for (const arrType of MEDIA_SETTINGS_ARR_TYPES) {
	test(`${arrType} media settings delete emits one name-guarded op`, async () => {
		const ctx = await seededPcd(`simple-${arrType}`, [
			seedFor(arrType, {
				name: 'Delete Media',
				propersRepacks: 'preferAndUpgrade',
				enableMediaInfo: true
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.mediaSettings.remove(ctx, arrType, 'Delete Media');

		const ops = userOpsSince(ctx, checkpoint);
		assertEquals(ops.length, 1);
		const op = ops[0];
		const metadata = parseMetadata(op);
		assertEquals(metadata.operation, 'delete');
		assertEquals(metadata.entity, entityForArrType(arrType));
		assertEquals(metadata.name, 'Delete Media');
		assertEquals(metadata.changed_fields, ['deleted']);
		const desired = parseDesiredState(op);
		assertEquals(desired.deleted, true);
		assertEquals(desired.name, 'Delete Media');
		assertEquals(desired.propers_repacks, 'preferAndUpgrade');
		assertEquals(desired.enable_media_info, true);

		const sql = normalizeSql(op.sql);
		const lowerSql = sql.toLowerCase();
		const deletePattern = new RegExp(`delete from "?${tableForArrType(arrType)}"?`, 'i');
		assert(deletePattern.test(sql));

		const deleteIndex = lowerSql.indexOf(`delete from "${tableForArrType(arrType)}"`);
		assert(deleteIndex >= 0, 'expected media settings delete in SQL');
		const deleteClause = sql.slice(deleteIndex);
		assert(/where "?name"? = /i.test(deleteClause));
		assert(
			!/where[^;]*"?propers_repacks"?\s*=/i.test(deleteClause),
			`propers_repacks should not appear in delete WHERE clause, got: ${deleteClause}`
		);
		assert(
			!/where[^;]*"?enable_media_info"?\s*=/i.test(deleteClause),
			`enable_media_info should not appear in delete WHERE clause, got: ${deleteClause}`
		);
	});
}

await run();
