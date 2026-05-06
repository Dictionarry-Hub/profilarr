/**
 * PCD write tests: media settings update (radarr + sonarr).
 *
 * The split-op tests will fail until the per-field splitting work for media
 * settings (task #4) ships. They pin the desired contract before the
 * implementation. The unchanged-submit test passes immediately.
 */

import { assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import { opCheckpoint, parseDesiredState, parseMetadata } from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import {
	assertOnlyField,
	assertSameGroup,
	createScenarioFactory,
	MEDIA_SETTINGS_ARR_TYPES,
	opForChangedField,
	userOpsSince
} from './helpers.ts';

const PORT = PORTS.pcd.writeMediaSettingsUpdate;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-media-settings-update');

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
 *   Base layer seeded with one media settings row via base.<arr>MediaSettings():
 *     name='Split Media', propersRepacks='doNotPrefer', enableMediaInfo=false
 *   Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/media-settings/{arrType}/Split%20Media?/update
 *     with form fields:
 *       name             = 'Split Media'           // unchanged
 *       propersRepacks   = 'preferAndUpgrade'     // changed
 *       enableMediaInfo  = 'true'                  // changed
 *       layer            = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 2
 *   - one op with metadata.changed_fields === ['propers_repacks']
 *   - one op with metadata.changed_fields === ['enable_media_info']
 *   - both ops share the same metadata.group_id
 */
for (const arrType of MEDIA_SETTINGS_ARR_TYPES) {
	test(`${arrType} independent scalar fields split into grouped ops`, async () => {
		const ctx = await seededPcd(`scalars-${arrType}`, [
			seedFor(arrType, {
				name: 'Split Media',
				propersRepacks: 'doNotPrefer',
				enableMediaInfo: false
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.mediaSettings.update(ctx, arrType, 'Split Media', {
			name: 'Split Media',
			propersRepacks: 'preferAndUpgrade',
			enableMediaInfo: true
		});

		const ops = userOpsSince(ctx, checkpoint);
		assertEquals(ops.length, 2);
		assertOnlyField(ops, 'propers_repacks');
		assertOnlyField(ops, 'enable_media_info');
		assertSameGroup(ops);
	});
}

/**
 * Context (per arr-type)
 *   Base layer seeded with one row:
 *     name='Old Media', propersRepacks='doNotPrefer', enableMediaInfo=false
 *   Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/media-settings/{arrType}/Old%20Media?/update
 *     with form fields:
 *       name             = 'New Media'             // changed
 *       propersRepacks   = 'preferAndUpgrade'     // changed
 *       enableMediaInfo  = 'false'                 // unchanged
 *       layer            = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 2
 *   - one op with metadata.changed_fields === ['propers_repacks']
 *   - one op with metadata.changed_fields === ['name']
 *   - both ops share the same metadata.group_id
 *   - rename op.metadata.name         === 'New Media'
 *   - rename op.metadata.previousName === 'Old Media'
 *   - rename op.desired_state.name    === { from: 'Old Media', to: 'New Media' }
 */
for (const arrType of MEDIA_SETTINGS_ARR_TYPES) {
	test(`${arrType} rename plus scalar change emits grouped split ops`, async () => {
		const ctx = await seededPcd(`rename-scalar-${arrType}`, [
			seedFor(arrType, {
				name: 'Old Media',
				propersRepacks: 'doNotPrefer',
				enableMediaInfo: false
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.mediaSettings.update(ctx, arrType, 'Old Media', {
			name: 'New Media',
			propersRepacks: 'preferAndUpgrade',
			enableMediaInfo: false
		});

		const ops = userOpsSince(ctx, checkpoint);
		assertEquals(ops.length, 2);
		assertOnlyField(ops, 'propers_repacks');
		assertOnlyField(ops, 'name');
		assertSameGroup(ops);
		const renameOp = opForChangedField(ops, 'name');
		const metadata = parseMetadata(renameOp);
		assertEquals(metadata.name, 'New Media');
		assertEquals(metadata.previousName, 'Old Media');
		assertEquals(parseDesiredState(renameOp).name, { from: 'Old Media', to: 'New Media' });
	});
}

/**
 * Context (per arr-type)
 *   Base layer seeded with one row:
 *     name='Pure Rename Media', propersRepacks='doNotPrefer', enableMediaInfo=false
 *   Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/media-settings/{arrType}/Pure%20Rename%20Media?/update
 *     with form fields:
 *       name             = 'Renamed Media'         // changed
 *       propersRepacks   = 'doNotPrefer'           // unchanged
 *       enableMediaInfo  = 'false'                 // unchanged
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.changed_fields === ['name']
 *   - op.metadata.group_id      === undefined
 *   - op.metadata.name          === 'Renamed Media'
 *   - op.metadata.previousName  === 'Pure Rename Media'
 *   - op.desired_state.name     === { from: 'Pure Rename Media', to: 'Renamed Media' }
 */
for (const arrType of MEDIA_SETTINGS_ARR_TYPES) {
	test(`${arrType} pure rename emits one ungrouped rename op`, async () => {
		const ctx = await seededPcd(`pure-rename-${arrType}`, [
			seedFor(arrType, {
				name: 'Pure Rename Media',
				propersRepacks: 'doNotPrefer',
				enableMediaInfo: false
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.mediaSettings.update(ctx, arrType, 'Pure Rename Media', {
			name: 'Renamed Media',
			propersRepacks: 'doNotPrefer',
			enableMediaInfo: false
		});

		const ops = userOpsSince(ctx, checkpoint);
		assertEquals(ops.length, 1);
		const renameOp = opForChangedField(ops, 'name');
		const metadata = parseMetadata(renameOp);
		assertEquals(metadata.group_id, undefined);
		assertEquals(metadata.name, 'Renamed Media');
		assertEquals(metadata.previousName, 'Pure Rename Media');
		assertEquals(parseDesiredState(renameOp).name, {
			from: 'Pure Rename Media',
			to: 'Renamed Media'
		});
	});
}

/**
 * Context (per arr-type)
 *   Base layer seeded with one row:
 *     name='Noop Media', propersRepacks='doNotPrefer', enableMediaInfo=false
 *   Compiled.
 *
 * Submit identical values.
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 0
 */
for (const arrType of MEDIA_SETTINGS_ARR_TYPES) {
	test(`${arrType} unchanged submit writes no ops`, async () => {
		const ctx = await seededPcd(`noop-${arrType}`, [
			seedFor(arrType, {
				name: 'Noop Media',
				propersRepacks: 'doNotPrefer',
				enableMediaInfo: false
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.mediaSettings.update(ctx, arrType, 'Noop Media', {
			name: 'Noop Media',
			propersRepacks: 'doNotPrefer',
			enableMediaInfo: false
		});

		assertEquals(userOpsSince(ctx, checkpoint).length, 0);
	});
}

await run();
