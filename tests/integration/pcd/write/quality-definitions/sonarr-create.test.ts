/**
 * PCD write tests: sonarr quality definitions create.
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import { normalizeSql, opCheckpoint, parseDesiredState, parseMetadata } from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import { assertActionFailed, createScenarioFactory, userOpsSince } from './helpers.ts';

const PORT = PORTS.pcd.writeQualityDefinitionsSonarrCreate;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-quality-def-sonarr-create');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

const TIER_NAMES = [
	{ name: 'HDTV-720p', arrType: 'sonarr' as const },
	{ name: 'WEBDL-1080p', arrType: 'sonarr' as const }
];

const TWO_TIERS = [
	{ quality_name: 'HDTV-720p', min_size: 1, max_size: 15, preferred_size: 8 },
	{ quality_name: 'WEBDL-1080p', min_size: 4, max_size: 40, preferred_size: 20 }
];

/**
 * Context
 *   PCD with qualities table seeded for HDTV-720p and WEBDL-1080p (sonarr).
 *
 * Submit
 *   POST /media-management/{ctx.dbId}/quality-definitions/new with form fields:
 *     arrType = 'sonarr'
 *     name    = 'Created QualityDefs'
 *     entries = JSON.stringify(TWO_TIERS)
 *     layer   = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.operation === 'create'
 *   - op.metadata.entity    === 'sonarr_quality_definitions'
 *   - op.metadata.name      === 'Created QualityDefs'
 *   - op.desired_state.entries length === 2
 *   - op.sql matches /insert into "?sonarr_quality_definitions"?/i
 */
test('minimal sonarr quality definitions emits one create op', async () => {
	const ctx = await seededPcd('minimal', [base.qualities({ entries: TIER_NAMES })]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityDefSonarr.create(ctx, {
		name: 'Created QualityDefs',
		entries: TWO_TIERS
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = ops[0];
	const metadata = parseMetadata(op);
	assertEquals(metadata.operation, 'create');
	assertEquals(metadata.entity, 'sonarr_quality_definitions');
	assertEquals(metadata.name, 'Created QualityDefs');
	const desired = parseDesiredState(op);
	assertEquals(desired.name, 'Created QualityDefs');
	assertEquals((desired.entries as unknown[]).length, 2);
	const sql = normalizeSql(op.sql);
	assert(/insert into "?sonarr_quality_definitions"?/i.test(sql));
});

/**
 * Context
 *   PCD with qualities seeded.
 *
 * Submit
 *   Create with non-default sizes.
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.desired_state.entries[HDTV-720p] has the submitted values
 */
test('sonarr quality definitions non-default sizes are recorded', async () => {
	const tunedTiers = [
		{ quality_name: 'HDTV-720p', min_size: 2, max_size: 18, preferred_size: 10 },
		{ quality_name: 'WEBDL-1080p', min_size: 5, max_size: 45, preferred_size: 22 }
	];
	const ctx = await seededPcd('tuned', [base.qualities({ entries: TIER_NAMES })]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityDefSonarr.create(ctx, {
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
	const hdtv = entries.find((e) => e.quality_name === 'HDTV-720p');
	assertEquals(hdtv?.min_size, 2);
	assertEquals(hdtv?.max_size, 18);
	assertEquals(hdtv?.preferred_size, 10);
});

/**
 * Context
 *   Base seeded with one config 'Existing QualityDefs'.
 *
 * Submit
 *   POST .../new with name='existing qualitydefs' (lowercase duplicate).
 *
 * Expect
 *   - response failure
 *   - userOpsSince(checkpoint).length === 0
 */
test('duplicate sonarr quality definitions name fails without writing ops', async () => {
	const ctx = await seededPcd('duplicate', [
		base.sonarrQualityDefinitions({ name: 'Existing QualityDefs', entries: TWO_TIERS })
	]);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.qualityDefSonarr.submitCreate(ctx, {
		name: 'existing qualitydefs',
		entries: TWO_TIERS
	});

	await assertActionFailed(response);
	assertEquals(userOpsSince(ctx, checkpoint).length, 0);
});

await run();
