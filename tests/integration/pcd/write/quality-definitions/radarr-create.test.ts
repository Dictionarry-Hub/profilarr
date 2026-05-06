/**
 * PCD write tests: radarr quality definitions create.
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import { normalizeSql, opCheckpoint, parseDesiredState, parseMetadata } from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import { assertActionFailed, createScenarioFactory, userOpsSince } from './helpers.ts';

const PORT = PORTS.pcd.writeQualityDefinitionsRadarrCreate;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-quality-def-radarr-create');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

const TIER_NAMES = [
	{ name: 'Bluray-1080p', arrType: 'radarr' as const },
	{ name: 'WEBDL-720p', arrType: 'radarr' as const }
];

const TWO_TIERS = [
	{ quality_name: 'Bluray-1080p', min_size: 5, max_size: 50, preferred_size: 30 },
	{ quality_name: 'WEBDL-720p', min_size: 1, max_size: 20, preferred_size: 10 }
];

/**
 * Context
 *   PCD with qualities table seeded for Bluray-1080p and WEBDL-720p (no
 *   quality_definitions rows). Compiled.
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/quality-definitions/new with form fields:
 *     arrType = 'radarr'
 *     name    = 'Created QualityDefs'
 *     entries = JSON.stringify(TWO_TIERS)
 *     layer   = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.operation === 'create'
 *   - op.metadata.entity    === 'radarr_quality_definitions'
 *   - op.metadata.name      === 'Created QualityDefs'
 *   - op.desired_state.name === 'Created QualityDefs'
 *   - op.desired_state.entries length === 2
 *   - op.sql matches /insert into "?radarr_quality_definitions"?/i
 */
test('minimal radarr quality definitions emits one create op', async () => {
	const ctx = await seededPcd('minimal', [base.qualities({ entries: TIER_NAMES })]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityDefRadarr.create(ctx, {
		name: 'Created QualityDefs',
		entries: TWO_TIERS
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = ops[0];
	const metadata = parseMetadata(op);
	assertEquals(metadata.operation, 'create');
	assertEquals(metadata.entity, 'radarr_quality_definitions');
	assertEquals(metadata.name, 'Created QualityDefs');
	const desired = parseDesiredState(op);
	assertEquals(desired.name, 'Created QualityDefs');
	assertEquals((desired.entries as unknown[]).length, 2);
	const sql = normalizeSql(op.sql);
	assert(/insert into "?radarr_quality_definitions"?/i.test(sql));
});

/**
 * Context
 *   PCD with qualities seeded.
 *
 * Submit
 *   Create with non-default size values.
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.desired_state.entries[Bluray-1080p].min_size === 7
 *   - op.desired_state.entries[Bluray-1080p].max_size === 60
 *   - op.desired_state.entries[Bluray-1080p].preferred_size === 35
 */
test('radarr quality definitions non-default sizes are recorded', async () => {
	const tunedTiers = [
		{ quality_name: 'Bluray-1080p', min_size: 7, max_size: 60, preferred_size: 35 },
		{ quality_name: 'WEBDL-720p', min_size: 2, max_size: 25, preferred_size: 12 }
	];
	const ctx = await seededPcd('tuned', [base.qualities({ entries: TIER_NAMES })]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityDefRadarr.create(ctx, {
		name: 'Tuned QualityDefs',
		entries: tunedTiers
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const desired = parseDesiredState(ops[0]);
	const entries = desired.entries as Array<{
		quality_name: string;
		min_size: number;
		max_size: number;
		preferred_size: number;
	}>;
	const bluray = entries.find((e) => e.quality_name === 'Bluray-1080p');
	assertEquals(bluray?.min_size, 7);
	assertEquals(bluray?.max_size, 60);
	assertEquals(bluray?.preferred_size, 35);
});

/**
 * Context
 *   Base layer seeded with one config 'Existing QualityDefs'.
 *
 * Submit
 *   POST .../new with name='existing qualitydefs' (lowercase duplicate).
 *
 * Expect
 *   - response.status >= 400 OR body contains '"type":"failure"'
 *   - userOpsSince(checkpoint).length === 0
 */
test('duplicate radarr quality definitions name fails without writing ops', async () => {
	const ctx = await seededPcd('duplicate', [
		base.radarrQualityDefinitions({ name: 'Existing QualityDefs', entries: TWO_TIERS })
	]);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.qualityDefRadarr.submitCreate(ctx, {
		name: 'existing qualitydefs',
		entries: TWO_TIERS
	});

	await assertActionFailed(response);
	assertEquals(userOpsSince(ctx, checkpoint).length, 0);
});

await run();
