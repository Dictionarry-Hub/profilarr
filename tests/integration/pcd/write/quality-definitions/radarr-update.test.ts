/**
 * PCD write tests: radarr quality definitions update.
 *
 * The split-op tests will fail until the per-row splitting work for quality
 * definitions (task #14) ships. They pin the desired contract before the
 * implementation, mirroring the regex / delay-profile / media-settings /
 * naming pattern.
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import { normalizeSql, opCheckpoint, parseDesiredState, parseMetadata } from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import {
	assertSameGroup,
	createScenarioFactory,
	opForChangedField,
	userOpsSince
} from './helpers.ts';

const PORT = PORTS.pcd.writeQualityDefinitionsRadarrUpdate;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-quality-def-radarr-update');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

const SEED_TIERS = [
	{ quality_name: 'Bluray-1080p', min_size: 5, max_size: 50, preferred_size: 30 },
	{ quality_name: 'WEBDL-720p', min_size: 1, max_size: 20, preferred_size: 10 }
];

function findOpForQualityName(ops: ReturnType<typeof userOpsSince>, qualityName: string) {
	return ops.find((op) => parseMetadata(op).qualityName === qualityName);
}

/**
 * Context
 *   Base layer seeded with one radarr_quality_definitions config 'Split QD':
 *     Bluray-1080p (5/50/30), WEBDL-720p (1/20/10)
 *   Compiled.
 *
 * Submit
 *   POST .../radarr/Split%20QD?/update with two tiers modified:
 *     Bluray-1080p -> (6/55/32)
 *     WEBDL-720p   -> (2/22/12)
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 2
 *   - one op with metadata.qualityName === 'Bluray-1080p'
 *   - one op with metadata.qualityName === 'WEBDL-720p'
 *   - both ops share the same metadata.group_id
 *   - both ops have changedFields covering size fields only
 */
test('representative per-tier modifications split into grouped ops', async () => {
	const ctx = await seededPcd('split-tiers', [
		base.radarrQualityDefinitions({ name: 'Split QD', entries: SEED_TIERS })
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityDefRadarr.update(ctx, 'Split QD', {
		name: 'Split QD',
		entries: [
			{ quality_name: 'Bluray-1080p', min_size: 6, max_size: 55, preferred_size: 32 },
			{ quality_name: 'WEBDL-720p', min_size: 2, max_size: 22, preferred_size: 12 }
		]
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 2);
	const blurayOp = findOpForQualityName(ops, 'Bluray-1080p');
	const webdlOp = findOpForQualityName(ops, 'WEBDL-720p');
	assert(blurayOp, 'expected per-tier op for Bluray-1080p');
	assert(webdlOp, 'expected per-tier op for WEBDL-720p');
	assertSameGroup(ops);
});

/**
 * Context
 *   Base seeded with 'Old QD' (Bluray-1080p, WEBDL-720p as above).
 *
 * Submit
 *   Rename to 'New QD' AND modify Bluray-1080p sizes.
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 2
 *   - one op with changed_fields === ['name'] and previousName === 'Old QD'
 *   - one op with metadata.qualityName === 'Bluray-1080p'
 *   - both ops share the same metadata.group_id
 */
test('rename plus tier modification emits grouped ops', async () => {
	const ctx = await seededPcd('rename-tier', [
		base.radarrQualityDefinitions({ name: 'Old QD', entries: SEED_TIERS })
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityDefRadarr.update(ctx, 'Old QD', {
		name: 'New QD',
		entries: [
			{ quality_name: 'Bluray-1080p', min_size: 6, max_size: 55, preferred_size: 32 },
			{ quality_name: 'WEBDL-720p', min_size: 1, max_size: 20, preferred_size: 10 }
		]
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 2);
	const renameOp = opForChangedField(ops, 'name');
	const renameMeta = parseMetadata(renameOp);
	assertEquals(renameMeta.previousName, 'Old QD');
	assertEquals(renameMeta.name, 'New QD');
	assertEquals(parseDesiredState(renameOp).name, { from: 'Old QD', to: 'New QD' });
	const blurayOp = findOpForQualityName(ops, 'Bluray-1080p');
	assert(blurayOp, 'expected per-tier op for Bluray-1080p');
	assertSameGroup(ops);
});

/**
 * Context
 *   Base seeded with 'Pure Rename QD' and full SEED_TIERS.
 *
 * Submit
 *   Rename to 'Renamed QD' with no tier changes.
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.changed_fields === ['name']
 *   - op.metadata.previousName === 'Pure Rename QD'
 *   - op.metadata.group_id === undefined
 *   - op.sql matches /update "?radarr_quality_definitions"? set "?name"? = ? where "?name"? = ?/i
 *     (single statement; no DELETE/INSERT chain)
 */
test('pure rename emits one ungrouped name op', async () => {
	const ctx = await seededPcd('pure-rename', [
		base.radarrQualityDefinitions({ name: 'Pure Rename QD', entries: SEED_TIERS })
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityDefRadarr.update(ctx, 'Pure Rename QD', {
		name: 'Renamed QD',
		entries: SEED_TIERS
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = ops[0];
	const metadata = parseMetadata(op);
	assertEquals(metadata.changed_fields, ['name']);
	assertEquals(metadata.previousName, 'Pure Rename QD');
	assertEquals(metadata.group_id, undefined);
	const sql = normalizeSql(op.sql).toLowerCase();
	assert(
		/update\s+"?radarr_quality_definitions"?\s+set\s+"?name"?\s*=/i.test(sql),
		`expected single UPDATE name=... statement, got: ${sql}`
	);
	assert(!/delete from/i.test(sql), `expected no DELETE in pure-rename SQL, got: ${sql}`);
	assert(!/insert into/i.test(sql), `expected no INSERT in pure-rename SQL, got: ${sql}`);
});

/**
 * Context
 *   Base seeded with 'Noop QD'.
 *
 * Submit identical name + entries.
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 0
 */
test('unchanged submit writes no ops', async () => {
	const ctx = await seededPcd('noop', [
		base.radarrQualityDefinitions({ name: 'Noop QD', entries: SEED_TIERS })
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityDefRadarr.update(ctx, 'Noop QD', {
		name: 'Noop QD',
		entries: SEED_TIERS
	});

	assertEquals(userOpsSince(ctx, checkpoint).length, 0);
});

await run();
