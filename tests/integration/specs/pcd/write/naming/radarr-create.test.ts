/**
 * PCD write tests: radarr naming create.
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
import { VALID_RADARR_NAMING_DEFAULTS, write } from '#integration/specs/pcd/harness/write.ts';
import { assertActionFailed, createScenarioFactory, userOpsSince } from './helpers.ts';

const PORT = PORTS.pcd.writeNamingRadarrCreate;
const ORIGIN = `http://localhost:${PORT}`;

const { newPcd, seededPcd } = createScenarioFactory(PORT, 'pcd-write-naming-radarr-create');

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
 *     arrType                  = 'radarr'
 *     name                     = 'Created Naming'
 *     rename                   = 'true'
 *     movieFormat              = '{Movie Title} ({Release Year})'
 *     movieFolderFormat        = '{Movie Title}'
 *     replaceIllegalCharacters = 'false'
 *     colonReplacementFormat   = 'delete'
 *     layer                    = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.operation === 'create'
 *   - op.metadata.entity    === 'radarr_naming'
 *   - op.metadata.name      === 'Created Naming'
 *   - op.desired_state.name                       === 'Created Naming'
 *   - op.desired_state.rename                     === true
 *   - op.desired_state.movie_format               === '{Movie Title} ({Release Year})'
 *   - op.desired_state.movie_folder_format        === '{Movie Title}'
 *   - op.desired_state.replace_illegal_characters === false
 *   - op.desired_state.colon_replacement_format   === 'delete'
 *   - op.sql matches /insert into "?radarr_naming"?/i
 */
test('minimal radarr naming emits one create op', async () => {
	const ctx = await newPcd('minimal');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	await write.namingRadarr.create(ctx, { name: 'Created Naming' });

	const ops = userOpsSince(ctx, checkpoint);
	expect(ops.length).toStrictEqual(1);
	const op = ops[0];
	const metadata = parseMetadata(op);
	expect(metadata.operation).toStrictEqual('create');
	expect(metadata.entity).toStrictEqual('radarr_naming');
	expect(metadata.name).toStrictEqual('Created Naming');
	const desired = parseDesiredState(op);
	expect(desired.name).toStrictEqual('Created Naming');
	expect(desired.rename).toStrictEqual(true);
	expect(desired.movie_format).toStrictEqual(VALID_RADARR_NAMING_DEFAULTS.movieFormat);
	expect(desired.movie_folder_format).toStrictEqual(VALID_RADARR_NAMING_DEFAULTS.movieFolderFormat);
	expect(desired.replace_illegal_characters).toStrictEqual(false);
	expect(desired.colon_replacement_format).toStrictEqual('delete');
	const sql = normalizeSql(op.sql);
	expect(/insert into "?radarr_naming"?/i.test(sql)).toBeTruthy();
});

/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/new with form fields:
 *     arrType                  = 'radarr'
 *     name                     = 'Tuned Naming'
 *     rename                   = 'false'
 *     movieFormat              = '{Movie Title} ({Release Year})'
 *     movieFolderFormat        = '{Movie Title} ({Release Year})'
 *     replaceIllegalCharacters = 'true'
 *     colonReplacementFormat   = 'dash'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.desired_state.rename                     === false
 *   - op.desired_state.movie_format               === '{Movie Title} ({Release Year})'
 *   - op.desired_state.movie_folder_format        === '{Movie Title} ({Release Year})'
 *   - op.desired_state.replace_illegal_characters === true
 *   - op.desired_state.colon_replacement_format   === 'dash'
 */
test('radarr naming non-default values are recorded', async () => {
	const ctx = await newPcd('tuned');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	await write.namingRadarr.create(ctx, {
		name: 'Tuned Naming',
		rename: false,
		movieFormat: '{Movie Title} ({Release Year})',
		movieFolderFormat: '{Movie Title} ({Release Year})',
		replaceIllegalCharacters: true,
		colonReplacementFormat: 'dash'
	});

	const ops = userOpsSince(ctx, checkpoint);
	expect(ops.length).toStrictEqual(1);
	const desired = parseDesiredState(ops[0]);
	expect(desired.rename).toStrictEqual(false);
	expect(desired.movie_format).toStrictEqual('{Movie Title} ({Release Year})');
	expect(desired.movie_folder_format).toStrictEqual('{Movie Title} ({Release Year})');
	expect(desired.replace_illegal_characters).toStrictEqual(true);
	expect(desired.colon_replacement_format).toStrictEqual('dash');
});

/**
 * Context
 *   Base layer seeded with one row named 'Existing Naming'. Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/new with form fields:
 *     arrType  = 'radarr'
 *     name     = 'existing naming'   // lowercase duplicate
 *     layer    = 'user'
 *
 * Expect
 *   - response.status >= 400 OR body contains '"type":"failure"'
 *   - userOpsSince(checkpoint).length === 0
 */
test('duplicate radarr naming name fails without writing ops', async () => {
	const ctx = await seededPcd('duplicate', [base.radarrNaming({ name: 'Existing Naming' })]);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.namingRadarr.submitCreate(ctx, { name: 'existing naming' });

	await assertActionFailed(response);
	expect(userOpsSince(ctx, checkpoint).length).toStrictEqual(0);
});

/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/new with form fields:
 *     arrType           = 'radarr'
 *     name              = 'Invalid Movie Format'
 *     movieFormat       = '{Movie Title}'
 *     movieFolderFormat = '{Movie Title}'
 *     layer             = 'user'
 *
 * Expect
 *   - response is a SvelteKit form failure
 *   - body contains "Movie format: Must contain either movie title and release year OR Original Title/Filename"
 *   - userOpsSince(checkpoint).length === 0
 */
test('radarr movie format missing required tokens fails without writing ops', async () => {
	const ctx = await newPcd('invalid-movie-format');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.namingRadarr.submitCreate(ctx, {
		name: 'Invalid Movie Format',
		movieFormat: '{Movie Title}',
		movieFolderFormat: VALID_RADARR_NAMING_DEFAULTS.movieFolderFormat
	});

	const body = await response.clone().text();
	expect(
		body.includes(
			'Movie format: Must contain either movie title and release year OR Original Title/Filename'
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
 *     arrType           = 'radarr'
 *     name              = 'Invalid Folder Format'
 *     movieFormat       = '{Movie Title} ({Release Year})'
 *     movieFolderFormat = '{Release Year}'
 *     layer             = 'user'
 *
 * Expect
 *   - response is a SvelteKit form failure
 *   - body contains "Folder format: Must contain movie title"
 *   - userOpsSince(checkpoint).length === 0
 */
test('radarr folder format missing movie title fails without writing ops', async () => {
	const ctx = await newPcd('invalid-folder-format');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.namingRadarr.submitCreate(ctx, {
		name: 'Invalid Folder Format',
		movieFormat: VALID_RADARR_NAMING_DEFAULTS.movieFormat,
		movieFolderFormat: '{Release Year}'
	});

	const body = await response.clone().text();
	expect(body.includes('Folder format: Must contain movie title')).toBeTruthy();
	await assertActionFailed(response);
	expect(userOpsSince(ctx, checkpoint).length).toStrictEqual(0);
});

/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/naming/new with form fields:
 *     arrType           = 'radarr'
 *     name              = 'Invalid Folder Token'
 *     movieFormat       = '{Movie Title} ({Release Year})'
 *     movieFolderFormat = '{Movie Title} {Quality Full}'
 *     layer             = 'user'
 *
 * Expect
 *   - response is a SvelteKit form failure
 *   - body contains "Folder format: Must not contain deprecated tokens"
 *   - userOpsSince(checkpoint).length === 0
 */
test('radarr folder format disallows file-derived tokens without writing ops', async () => {
	const ctx = await newPcd('invalid-folder-token');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.namingRadarr.submitCreate(ctx, {
		name: 'Invalid Folder Token',
		movieFormat: VALID_RADARR_NAMING_DEFAULTS.movieFormat,
		movieFolderFormat: '{Movie Title} {Quality Full}'
	});

	const body = await response.clone().text();
	expect(body.includes('Folder format: Must not contain deprecated tokens')).toBeTruthy();
	await assertActionFailed(response);
	expect(userOpsSince(ctx, checkpoint).length).toStrictEqual(0);
});
