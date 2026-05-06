/**
 * PCD write tests: radarr naming update.
 *
 * The split-op tests will fail until the per-field splitting work for naming
 * (task #9) ships. They pin the desired contract before the implementation,
 * mirroring the regex / delay-profile / media-settings pattern.
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
	opForChangedField,
	userOpsSince
} from './helpers.ts';

const PORT = PORTS.pcd.writeNamingRadarrUpdate;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-naming-radarr-update');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Base layer seeded with one radarr_naming row:
 *     name='Split Naming', rename=true, movieFormat='{Movie Title}',
 *     movieFolderFormat='{Movie Title}', replaceIllegalCharacters=false,
 *     colonReplacementFormat='delete'
 *   Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/radarr/Split%20Naming?/update
 *     with form fields:
 *       name                     = 'Split Naming'                 // unchanged
 *       rename                   = 'true'                         // unchanged
 *       movieFormat              = '{Movie Title} ({Release Year})'  // changed
 *       movieFolderFormat        = '{Movie Title}'                // unchanged
 *       replaceIllegalCharacters = 'true'                         // changed (bool)
 *       colonReplacementFormat   = 'delete'                       // unchanged
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 2
 *   - one op with metadata.changed_fields === ['movie_format']
 *   - one op with metadata.changed_fields === ['replace_illegal_characters']
 *   - both ops share the same metadata.group_id
 */
test('representative scalar fields split into grouped ops', async () => {
	const ctx = await seededPcd('scalars', [
		base.radarrNaming({
			name: 'Split Naming',
			movieFormat: '{Movie Title}',
			movieFolderFormat: '{Movie Title}'
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.namingRadarr.update(ctx, 'Split Naming', {
		name: 'Split Naming',
		rename: true,
		movieFormat: '{Movie Title} ({Release Year})',
		movieFolderFormat: '{Movie Title}',
		replaceIllegalCharacters: true,
		colonReplacementFormat: 'delete'
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 2);
	assertOnlyField(ops, 'movie_format');
	assertOnlyField(ops, 'replace_illegal_characters');
	assertSameGroup(ops);
});

/**
 * Context
 *   Base layer seeded with one row:
 *     name='Old Naming', movieFormat='{Movie Title}', other fields default
 *   Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/radarr/Old%20Naming?/update
 *     with form fields:
 *       name                     = 'New Naming'           // changed
 *       movieFormat              = '{Movie Title} ({Release Year})'  // changed
 *       (others unchanged)
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 2
 *   - one op with metadata.changed_fields === ['movie_format']
 *   - one op with metadata.changed_fields === ['name']
 *   - both ops share the same metadata.group_id
 *   - rename op.metadata.name         === 'New Naming'
 *   - rename op.metadata.previousName === 'Old Naming'
 *   - rename op.desired_state.name    === { from: 'Old Naming', to: 'New Naming' }
 */
test('rename plus scalar change emits grouped split ops', async () => {
	const ctx = await seededPcd('rename-scalar', [
		base.radarrNaming({
			name: 'Old Naming',
			movieFormat: '{Movie Title}',
			movieFolderFormat: '{Movie Title}'
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.namingRadarr.update(ctx, 'Old Naming', {
		name: 'New Naming',
		rename: true,
		movieFormat: '{Movie Title} ({Release Year})',
		movieFolderFormat: '{Movie Title}',
		replaceIllegalCharacters: false,
		colonReplacementFormat: 'delete'
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 2);
	assertOnlyField(ops, 'movie_format');
	assertOnlyField(ops, 'name');
	assertSameGroup(ops);
	const renameOp = opForChangedField(ops, 'name');
	const metadata = parseMetadata(renameOp);
	assertEquals(metadata.name, 'New Naming');
	assertEquals(metadata.previousName, 'Old Naming');
	assertEquals(parseDesiredState(renameOp).name, { from: 'Old Naming', to: 'New Naming' });
});

/**
 * Context
 *   Base layer seeded with one row:
 *     name='Pure Rename', other fields default
 *   Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/radarr/Pure%20Rename?/update
 *     with form fields:
 *       name = 'Renamed'   // changed
 *       (all others unchanged)
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.changed_fields === ['name']
 *   - op.metadata.group_id      === undefined
 *   - op.metadata.name          === 'Renamed'
 *   - op.metadata.previousName  === 'Pure Rename'
 *   - op.desired_state.name     === { from: 'Pure Rename', to: 'Renamed' }
 */
test('pure rename emits one ungrouped rename op', async () => {
	const ctx = await seededPcd('pure-rename', [base.radarrNaming({ name: 'Pure Rename' })]);
	const checkpoint = opCheckpoint(ctx);

	await write.namingRadarr.update(ctx, 'Pure Rename', {
		name: 'Renamed',
		rename: true,
		movieFormat: '',
		movieFolderFormat: '',
		replaceIllegalCharacters: false,
		colonReplacementFormat: 'delete'
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const renameOp = opForChangedField(ops, 'name');
	const metadata = parseMetadata(renameOp);
	assertEquals(metadata.group_id, undefined);
	assertEquals(metadata.name, 'Renamed');
	assertEquals(metadata.previousName, 'Pure Rename');
	assertEquals(parseDesiredState(renameOp).name, { from: 'Pure Rename', to: 'Renamed' });
});

/**
 * Context
 *   Base layer seeded with one row:
 *     name='Noop Naming', defaults
 *   Compiled.
 *
 * Submit identical values.
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 0
 */
test('unchanged submit writes no ops', async () => {
	const ctx = await seededPcd('noop', [base.radarrNaming({ name: 'Noop Naming' })]);
	const checkpoint = opCheckpoint(ctx);

	await write.namingRadarr.update(ctx, 'Noop Naming', {
		name: 'Noop Naming',
		rename: true,
		movieFormat: '',
		movieFolderFormat: '',
		replaceIllegalCharacters: false,
		colonReplacementFormat: 'delete'
	});

	assertEquals(userOpsSince(ctx, checkpoint).length, 0);
});

await run();
