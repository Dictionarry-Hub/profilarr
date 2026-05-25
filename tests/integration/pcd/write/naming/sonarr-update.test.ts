/**
 * PCD write tests: sonarr naming update.
 *
 * The split-op tests will fail until the per-field splitting work for naming
 * (task #9) ships. They pin the desired contract before the implementation.
 *
 * The Sonarr split test deliberately exercises every distinct datatype shape
 * the splitter must handle: string, bool, nullable text, and int-coded enum.
 */

import { assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import { opCheckpoint, parseDesiredState, parseMetadata } from '../../harness/pcd.ts';
import { VALID_SONARR_NAMING_DEFAULTS, write } from '../../harness/write.ts';
import {
	assertOnlyField,
	assertSameGroup,
	createScenarioFactory,
	opForChangedField,
	userOpsSince
} from './helpers.ts';

const PORT = PORTS.pcd.writeNamingSonarrUpdate;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-naming-sonarr-update');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Base layer seeded with one sonarr_naming row:
 *     name='Split Naming', standardEpisodeFormat='{Series Title} - S{season:00}E{episode:00}',
 *     dailyEpisodeFormat='{Series Title} - {Air-Date}',
 *     animeEpisodeFormat='{Series Title} - {absolute:000}',
 *     seriesFolderFormat='{Series Title}', seasonFolderFormat='Season {season:00}',
 *     replaceIllegalCharacters=false, colonReplacementFormat='delete',
 *     customColonReplacementFormat=null, multiEpisodeStyle='extend'
 *   Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/sonarr/Split%20Naming?/update
 *     with form fields changing:
 *       standardEpisodeFormat        = 'S{season}E{episode}'                         // string
 *       replaceIllegalCharacters     = 'true'                                        // bool
 *       customColonReplacementFormat = ' - '                                         // nullable text (null -> value)
 *       multiEpisodeStyle            = 'range'                                       // int-coded enum
 *     and keeping all other fields unchanged.
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 4
 *   - one op with changed_fields === ['standard_episode_format']
 *   - one op with changed_fields === ['replace_illegal_characters']
 *   - one op with changed_fields === ['custom_colon_replacement_format']
 *   - one op with changed_fields === ['multi_episode_style']
 *   - all four ops share the same metadata.group_id
 */
test('representative scalar fields across datatype shapes split into grouped ops', async () => {
	const ctx = await seededPcd('scalars', [
		base.sonarrNaming({
			name: 'Split Naming',
			standardEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat,
			dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
			animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
			seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
			seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.namingSonarr.update(ctx, 'Split Naming', {
		name: 'Split Naming',
		rename: true,
		standardEpisodeFormat: 'S{season}E{episode}',
		dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
		animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
		seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
		seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat,
		replaceIllegalCharacters: true,
		colonReplacementFormat: 'delete',
		customColonReplacementFormat: ' - ',
		multiEpisodeStyle: 'range'
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 4);
	assertOnlyField(ops, 'standard_episode_format');
	assertOnlyField(ops, 'replace_illegal_characters');
	assertOnlyField(ops, 'custom_colon_replacement_format');
	assertOnlyField(ops, 'multi_episode_style');
	assertSameGroup(ops);
});

/**
 * Context
 *   Base layer seeded with one row:
 *     name='Old Naming', standardEpisodeFormat='{Series Title} - S{season:00}E{episode:00}',
 *     other fields valid defaults
 *   Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/sonarr/Old%20Naming?/update
 *     with form fields:
 *       name                  = 'New Naming'                                  // changed
 *       standardEpisodeFormat = 'S{season}E{episode}'  // changed
 *       (others unchanged)
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 2
 *   - one op with changed_fields === ['standard_episode_format']
 *   - one op with changed_fields === ['name']
 *   - both ops share the same metadata.group_id
 *   - rename op.metadata.name         === 'New Naming'
 *   - rename op.metadata.previousName === 'Old Naming'
 *   - rename op.desired_state.name    === { from: 'Old Naming', to: 'New Naming' }
 */
test('rename plus scalar change emits grouped split ops', async () => {
	const ctx = await seededPcd('rename-scalar', [
		base.sonarrNaming({
			name: 'Old Naming',
			standardEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat,
			dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
			animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
			seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
			seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.namingSonarr.update(ctx, 'Old Naming', {
		name: 'New Naming',
		rename: true,
		standardEpisodeFormat: 'S{season}E{episode}',
		dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
		animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
		seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
		seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat,
		replaceIllegalCharacters: false,
		colonReplacementFormat: 'delete',
		customColonReplacementFormat: null,
		multiEpisodeStyle: 'extend'
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 2);
	assertOnlyField(ops, 'standard_episode_format');
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
 *     name='Pure Rename', valid defaults
 *   Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/sonarr/Pure%20Rename?/update
 *     with form fields:
 *       name = 'Renamed'   // changed
 *       standardEpisodeFormat = '{Series Title} - S{season:00}E{episode:00}'
 *       dailyEpisodeFormat    = '{Series Title} - {Air-Date}'
 *       animeEpisodeFormat    = '{Series Title} - {absolute:000}'
 *       seriesFolderFormat    = '{Series Title}'
 *       seasonFolderFormat    = 'Season {season:00}'
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
	const ctx = await seededPcd('pure-rename', [
		base.sonarrNaming({
			name: 'Pure Rename',
			standardEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat,
			dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
			animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
			seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
			seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.namingSonarr.update(ctx, 'Pure Rename', {
		name: 'Renamed',
		rename: true,
		standardEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat,
		dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
		animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
		seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
		seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat,
		replaceIllegalCharacters: false,
		colonReplacementFormat: 'delete',
		customColonReplacementFormat: null,
		multiEpisodeStyle: 'extend'
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
 *     name='Noop Naming', valid defaults
 *   Compiled.
 *
 * Submit identical values.
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 0
 */
test('unchanged submit writes no ops', async () => {
	const ctx = await seededPcd('noop', [
		base.sonarrNaming({
			name: 'Noop Naming',
			standardEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat,
			dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
			animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
			seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
			seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.namingSonarr.update(ctx, 'Noop Naming', {
		name: 'Noop Naming',
		rename: true,
		standardEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat,
		dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
		animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
		seriesFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
		seasonFolderFormat: VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat,
		replaceIllegalCharacters: false,
		colonReplacementFormat: 'delete',
		customColonReplacementFormat: null,
		multiEpisodeStyle: 'extend'
	});

	assertEquals(userOpsSince(ctx, checkpoint).length, 0);
});

await run();
