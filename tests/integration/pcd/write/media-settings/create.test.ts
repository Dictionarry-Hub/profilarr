/**
 * PCD write tests: media settings create (radarr + sonarr).
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import {
	compilePcd,
	normalizeSql,
	opCheckpoint,
	parseDesiredState,
	parseMetadata
} from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import {
	assertActionFailed,
	createScenarioFactory,
	entityForArrType,
	MEDIA_SETTINGS_ARR_TYPES,
	tableForArrType,
	userOpsSince
} from './helpers.ts';

const PORT = PORTS.pcd.writeMediaSettingsCreate;
const ORIGIN = `http://localhost:${PORT}`;

const { newPcd, seededPcd } = createScenarioFactory(PORT, 'pcd-write-media-settings-create');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit (per arr-type)
 *   POST /media-management/{ctx.dbId}/media-settings/new with form fields:
 *     arrType                  = 'radarr' | 'sonarr'
 *     name                     = 'Created Media'
 *     propersRepacks           = 'doNotPrefer'
 *     enableMediaInfo          = 'false'
 *     layer                    = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.operation       === 'create'
 *   - op.metadata.entity          === '<arrType>_media_settings'
 *   - op.metadata.name            === 'Created Media'
 *   - op.desired_state.name       === 'Created Media'
 *   - op.desired_state.propers_repacks === 'doNotPrefer'
 *   - op.desired_state.enable_media_info === false
 *   - op.sql matches /insert into "?<arrType>_media_settings"?/i
 */
for (const arrType of MEDIA_SETTINGS_ARR_TYPES) {
	test(`minimal ${arrType} media settings emits one create op`, async () => {
		const ctx = await newPcd(`minimal-${arrType}`);
		await compilePcd(ctx);
		const checkpoint = opCheckpoint(ctx);

		await write.mediaSettings.create(ctx, arrType, { name: 'Created Media' });

		const ops = userOpsSince(ctx, checkpoint);
		assertEquals(ops.length, 1);
		const op = ops[0];
		const metadata = parseMetadata(op);
		assertEquals(metadata.operation, 'create');
		assertEquals(metadata.entity, entityForArrType(arrType));
		assertEquals(metadata.name, 'Created Media');
		const desired = parseDesiredState(op);
		assertEquals(desired.name, 'Created Media');
		assertEquals(desired.propers_repacks, 'doNotPrefer');
		assertEquals(desired.enable_media_info, false);
		const sql = normalizeSql(op.sql);
		const insertPattern = new RegExp(`insert into "?${tableForArrType(arrType)}"?`, 'i');
		assert(insertPattern.test(sql));
	});
}

/**
 * Context (per arr-type)
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/media-settings/new with form fields:
 *     arrType                  = 'radarr' | 'sonarr'
 *     name                     = 'Tuned Media'
 *     propersRepacks           = 'preferAndUpgrade'
 *     enableMediaInfo          = 'true'
 *     layer                    = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.desired_state.propers_repacks === 'preferAndUpgrade'
 *   - op.desired_state.enable_media_info === true
 */
for (const arrType of MEDIA_SETTINGS_ARR_TYPES) {
	test(`${arrType} media settings non-default values are recorded`, async () => {
		const ctx = await newPcd(`tuned-${arrType}`);
		await compilePcd(ctx);
		const checkpoint = opCheckpoint(ctx);

		await write.mediaSettings.create(ctx, arrType, {
			name: 'Tuned Media',
			propersRepacks: 'preferAndUpgrade',
			enableMediaInfo: true
		});

		const ops = userOpsSince(ctx, checkpoint);
		assertEquals(ops.length, 1);
		const desired = parseDesiredState(ops[0]);
		assertEquals(desired.propers_repacks, 'preferAndUpgrade');
		assertEquals(desired.enable_media_info, true);
	});
}

/**
 * Context (per arr-type)
 *   Base layer seeded with a row named 'Existing Media' for the arr-type.
 *   Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/media-settings/new with form fields:
 *     arrType  = 'radarr' | 'sonarr'
 *     name     = 'existing media'   // lowercase duplicate
 *     layer    = 'user'
 *
 * Expect
 *   - response.status >= 400 OR body contains '"type":"failure"'
 *   - userOpsSince(checkpoint).length === 0
 */
for (const arrType of MEDIA_SETTINGS_ARR_TYPES) {
	test(`duplicate ${arrType} media settings name fails without writing ops`, async () => {
		const seed =
			arrType === 'radarr'
				? base.radarrMediaSettings({ name: 'Existing Media' })
				: base.sonarrMediaSettings({ name: 'Existing Media' });

		const ctx = await seededPcd(`duplicate-${arrType}`, [seed]);
		const checkpoint = opCheckpoint(ctx);

		const response = await write.mediaSettings.submitCreate(ctx, arrType, {
			name: 'existing media'
		});

		await assertActionFailed(response);
		assertEquals(userOpsSince(ctx, checkpoint).length, 0);
	});
}

await run();
