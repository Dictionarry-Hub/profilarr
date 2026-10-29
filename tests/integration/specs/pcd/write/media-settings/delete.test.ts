/**
 * PCD write tests: media settings delete (radarr + sonarr).
 *
 * The name-only-guard SQL assertion will fail until the delete writer drops
 * its non-name guards (covered by task #5). It pins the desired contract
 * before the implementation, mirroring the regex / delay-profile pattern.
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
	createScenarioFactory,
	entityForArrType,
	MEDIA_SETTINGS_ARR_TYPES,
	tableForArrType,
	userOpsSince
} from './helpers.ts';

const PORT = PORTS.pcd.writeMediaSettingsDelete;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-media-settings-delete');

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

afterAll(async () => {
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
		expect(ops.length).toStrictEqual(1);
		const op = ops[0];
		const metadata = parseMetadata(op);
		expect(metadata.operation).toStrictEqual('delete');
		expect(metadata.entity).toStrictEqual(entityForArrType(arrType));
		expect(metadata.name).toStrictEqual('Delete Media');
		expect(metadata.changed_fields).toStrictEqual(['deleted']);
		const desired = parseDesiredState(op);
		expect(desired.deleted).toStrictEqual(true);
		expect(desired.name).toStrictEqual('Delete Media');
		expect(desired.propers_repacks).toStrictEqual('preferAndUpgrade');
		expect(desired.enable_media_info).toStrictEqual(true);

		const sql = normalizeSql(op.sql);
		const lowerSql = sql.toLowerCase();
		const deletePattern = new RegExp(`delete from "?${tableForArrType(arrType)}"?`, 'i');
		expect(deletePattern.test(sql)).toBeTruthy();

		const deleteIndex = lowerSql.indexOf(`delete from "${tableForArrType(arrType)}"`);
		expect(deleteIndex >= 0, 'expected media settings delete in SQL').toBeTruthy();
		const deleteClause = sql.slice(deleteIndex);
		expect(/where "?name"? = /i.test(deleteClause)).toBeTruthy();
		expect(
			!/where[^;]*"?propers_repacks"?\s*=/i.test(deleteClause),
			`propers_repacks should not appear in delete WHERE clause, got: ${deleteClause}`
		).toBeTruthy();
		expect(
			!/where[^;]*"?enable_media_info"?\s*=/i.test(deleteClause),
			`enable_media_info should not appear in delete WHERE clause, got: ${deleteClause}`
		).toBeTruthy();
	});
}
