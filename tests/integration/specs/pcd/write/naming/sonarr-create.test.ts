/**
 * PCD write tests: sonarr naming create.
 */

import { startServer, stopServer } from '#integration/harness/server.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { base } from '#integration/specs/pcd/harness/fixtures.ts';
import {
	compilePcd,
	normalizeSql,
	opCheckpoint,
	parseDesiredState,
	parseMetadata
} from '#integration/specs/pcd/harness/pcd.ts';
import { VALID_SONARR_NAMING_DEFAULTS, write } from '#integration/specs/pcd/harness/write.ts';
import { assertActionFailed, createScenarioFactory, userOpsSince } from './helpers.ts';

const PORT = PORTS.pcd.writeNamingSonarrCreate;
const ORIGIN = `http://localhost:${PORT}`;

const { newPcd, seededPcd } = createScenarioFactory(PORT, 'pcd-write-naming-sonarr-create');

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

afterAll(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/new with form fields:
 *     arrType                       = 'sonarr'
 *     name                          = 'Created Naming'
 *     rename                        = 'true'
 *     standardEpisodeFormat         = '{Series Title} - S{season:00}E{episode:00}'
 *     dailyEpisodeFormat            = '{Series Title} - {Air-Date}'
 *     animeEpisodeFormat            = '{Series Title} - {absolute:000}'
 *     seriesFolderFormat            = '{Series Title}'
 *     seasonFolderFormat            = 'Season {season:00}'
 *     replaceIllegalCharacters      = 'false'
 *     colonReplacementFormat        = 'delete'
 *     customColonReplacementFormat  = ''   // null when blank
 *     multiEpisodeStyle             = 'extend'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.operation === 'create'
 *   - op.metadata.entity    === 'sonarr_naming'
 *   - op.metadata.name      === 'Created Naming'
 *   - op.desired_state.name                            === 'Created Naming'
 *   - op.desired_state.rename                          === true
 *   - op.desired_state.standard_episode_format         === '{Series Title} - S{season:00}E{episode:00}'
 *   - op.desired_state.daily_episode_format            === '{Series Title} - {Air-Date}'
 *   - op.desired_state.anime_episode_format            === '{Series Title} - {absolute:000}'
 *   - op.desired_state.series_folder_format            === '{Series Title}'
 *   - op.desired_state.season_folder_format            === 'Season {season:00}'
 *   - op.desired_state.replace_illegal_characters      === false
 *   - op.desired_state.colon_replacement_format        === 'delete'
 *   - op.desired_state.custom_colon_replacement_format === null
 *   - op.desired_state.multi_episode_style             === 'extend'
 *   - op.sql matches /insert into "?sonarr_naming"?/i
 */
test('minimal sonarr naming emits one create op', async () => {
	const ctx = await newPcd('minimal');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	await write.namingSonarr.create(ctx, { name: 'Created Naming' });

	const ops = userOpsSince(ctx, checkpoint);
	expect(ops.length).toStrictEqual(1);
	const op = ops[0];
	const metadata = parseMetadata(op);
	expect(metadata.operation).toStrictEqual('create');
	expect(metadata.entity).toStrictEqual('sonarr_naming');
	expect(metadata.name).toStrictEqual('Created Naming');
	const desired = parseDesiredState(op);
	expect(desired.name).toStrictEqual('Created Naming');
	expect(desired.rename).toStrictEqual(true);
	expect(desired.standard_episode_format).toStrictEqual(
		VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat
	);
	expect(desired.daily_episode_format).toStrictEqual(
		VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat
	);
	expect(desired.anime_episode_format).toStrictEqual(
		VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat
	);
	expect(desired.series_folder_format).toStrictEqual(
		VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat
	);
	expect(desired.season_folder_format).toStrictEqual(
		VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat
	);
	expect(desired.replace_illegal_characters).toStrictEqual(false);
	expect(desired.colon_replacement_format).toStrictEqual('delete');
	expect(desired.custom_colon_replacement_format).toStrictEqual(null);
	expect(desired.multi_episode_style).toStrictEqual('extend');
	const sql = normalizeSql(op.sql);
	expect(/insert into "?sonarr_naming"?/i.test(sql)).toBeTruthy();
});

/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/new with form fields:
 *     arrType                       = 'sonarr'
 *     name                          = 'Tuned Naming'
 *     rename                        = 'false'
 *     standardEpisodeFormat         = 'S{season}E{episode}'
 *     dailyEpisodeFormat            = '{Series Title} - {Air-Date}'
 *     animeEpisodeFormat            = '{Series Title} - {absolute:000}'
 *     seriesFolderFormat            = '{Series Title}'
 *     seasonFolderFormat            = 'Season {season:00}'
 *     replaceIllegalCharacters      = 'true'
 *     colonReplacementFormat        = 'custom'
 *     customColonReplacementFormat  = ' - '
 *     multiEpisodeStyle             = 'range'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.desired_state.rename                          === false
 *   - op.desired_state.standard_episode_format         === 'S{season}E{episode}'
 *   - op.desired_state.replace_illegal_characters      === true
 *   - op.desired_state.colon_replacement_format        === 'custom'
 *   - op.desired_state.custom_colon_replacement_format === ' - '
 *   - op.desired_state.multi_episode_style             === 'range'
 */
test('sonarr naming non-default values are recorded', async () => {
	const ctx = await newPcd('tuned');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	await write.namingSonarr.create(ctx, {
		name: 'Tuned Naming',
		rename: false,
		standardEpisodeFormat: 'S{season}E{episode}',
		dailyEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
		animeEpisodeFormat: VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
		seriesFolderFormat: '{Series Title}',
		seasonFolderFormat: 'Season {season:00}',
		replaceIllegalCharacters: true,
		colonReplacementFormat: 'custom',
		customColonReplacementFormat: ' - ',
		multiEpisodeStyle: 'range'
	});

	const ops = userOpsSince(ctx, checkpoint);
	expect(ops.length).toStrictEqual(1);
	const desired = parseDesiredState(ops[0]);
	expect(desired.rename).toStrictEqual(false);
	expect(desired.standard_episode_format).toStrictEqual('S{season}E{episode}');
	expect(desired.replace_illegal_characters).toStrictEqual(true);
	expect(desired.colon_replacement_format).toStrictEqual('custom');
	expect(desired.custom_colon_replacement_format).toStrictEqual(' - ');
	expect(desired.multi_episode_style).toStrictEqual('range');
});

/**
 * Context
 *   Base layer seeded with one row named 'Existing Naming'. Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/new with form fields:
 *     arrType  = 'sonarr'
 *     name     = 'existing naming'   // lowercase duplicate
 *     layer    = 'user'
 *
 * Expect
 *   - response.status >= 400 OR body contains '"type":"failure"'
 *   - userOpsSince(checkpoint).length === 0
 */
test('duplicate sonarr naming name fails without writing ops', async () => {
	const ctx = await seededPcd('duplicate', [base.sonarrNaming({ name: 'Existing Naming' })]);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.namingSonarr.submitCreate(ctx, { name: 'existing naming' });

	await assertActionFailed(response);
	expect(userOpsSince(ctx, checkpoint).length).toStrictEqual(0);
});

/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/new with form fields:
 *     arrType               = 'sonarr'
 *     name                  = 'Invalid Standard Format'
 *     standardEpisodeFormat = '{Series Title}'
 *     layer                 = 'user'
 *
 * Expect
 *   - response is a SvelteKit form failure
 *   - body contains "Standard episode format: Must contain season and episode numbers OR Original Title"
 *   - userOpsSince(checkpoint).length === 0
 */
test('sonarr standard episode format missing numbering fails without writing ops', async () => {
	const ctx = await newPcd('invalid-standard-format');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.namingSonarr.submitCreate(ctx, {
		name: 'Invalid Standard Format',
		standardEpisodeFormat: '{Series Title}'
	});

	const body = await response.clone().text();
	expect(
		body.includes(
			'Standard episode format: Must contain season and episode numbers OR Original Title'
		)
	).toBeTruthy();
	await assertActionFailed(response);
	expect(userOpsSince(ctx, checkpoint).length).toStrictEqual(0);
});

/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/new with form fields:
 *     arrType            = 'sonarr'
 *     name               = 'Invalid Daily Format'
 *     dailyEpisodeFormat = '{Series Title}'
 *     layer              = 'user'
 *
 * Expect
 *   - response is a SvelteKit form failure
 *   - body contains "Daily episode format: Must contain Air Date OR Season and Episode OR Original Title"
 *   - userOpsSince(checkpoint).length === 0
 */
test('sonarr daily episode format missing date or numbering fails without writing ops', async () => {
	const ctx = await newPcd('invalid-daily-format');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.namingSonarr.submitCreate(ctx, {
		name: 'Invalid Daily Format',
		dailyEpisodeFormat: '{Series Title}'
	});

	const body = await response.clone().text();
	expect(
		body.includes(
			'Daily episode format: Must contain Air Date OR Season and Episode OR Original Title'
		)
	).toBeTruthy();
	await assertActionFailed(response);
	expect(userOpsSince(ctx, checkpoint).length).toStrictEqual(0);
});

/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/new with form fields:
 *     arrType            = 'sonarr'
 *     name               = 'Invalid Anime Format'
 *     animeEpisodeFormat = '{Series Title}'
 *     layer              = 'user'
 *
 * Expect
 *   - response is a SvelteKit form failure
 *   - body contains "Anime episode format: Must contain Absolute Episode number OR Season and Episode OR Original Title"
 *   - userOpsSince(checkpoint).length === 0
 */
test('sonarr anime episode format missing absolute or numbering fails without writing ops', async () => {
	const ctx = await newPcd('invalid-anime-format');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.namingSonarr.submitCreate(ctx, {
		name: 'Invalid Anime Format',
		animeEpisodeFormat: '{Series Title}'
	});

	const body = await response.clone().text();
	expect(
		body.includes(
			'Anime episode format: Must contain Absolute Episode number OR Season and Episode OR Original Title'
		)
	).toBeTruthy();
	await assertActionFailed(response);
	expect(userOpsSince(ctx, checkpoint).length).toStrictEqual(0);
});

/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/new with form fields:
 *     arrType            = 'sonarr'
 *     name               = 'Invalid Series Folder'
 *     seriesFolderFormat = '{Series Year}'
 *     layer              = 'user'
 *
 * Expect
 *   - response is a SvelteKit form failure
 *   - body contains "Series folder format: Must contain series title"
 *   - userOpsSince(checkpoint).length === 0
 */
test('sonarr series folder format missing series title fails without writing ops', async () => {
	const ctx = await newPcd('invalid-series-folder');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.namingSonarr.submitCreate(ctx, {
		name: 'Invalid Series Folder',
		seriesFolderFormat: '{Series Year}'
	});

	const body = await response.clone().text();
	expect(body.includes('Series folder format: Must contain series title')).toBeTruthy();
	await assertActionFailed(response);
	expect(userOpsSince(ctx, checkpoint).length).toStrictEqual(0);
});

/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/new with form fields:
 *     arrType            = 'sonarr'
 *     name               = 'Invalid Season Folder'
 *     seasonFolderFormat = 'Season'
 *     layer              = 'user'
 *
 * Expect
 *   - response is a SvelteKit form failure
 *   - body contains "Season folder format: Must contain season number"
 *   - userOpsSince(checkpoint).length === 0
 */
test('sonarr season folder format missing season number fails without writing ops', async () => {
	const ctx = await newPcd('invalid-season-folder');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.namingSonarr.submitCreate(ctx, {
		name: 'Invalid Season Folder',
		seasonFolderFormat: 'Season'
	});

	const body = await response.clone().text();
	expect(body.includes('Season folder format: Must contain season number')).toBeTruthy();
	await assertActionFailed(response);
	expect(userOpsSince(ctx, checkpoint).length).toStrictEqual(0);
});
