/**
 * PCD write tests: sonarr quality definitions update.
 *
 * The split-op tests will fail until the per-row splitting work for quality
 * definitions (task #14) ships. They pin the desired contract before the
 * implementation.
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

const PORT = PORTS.pcd.writeQualityDefinitionsSonarrUpdate;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-quality-def-sonarr-update');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

const SEED_TIERS = [
	{ quality_name: 'HDTV-720p', min_size: 1, max_size: 15, preferred_size: 8 },
	{ quality_name: 'WEBDL-1080p', min_size: 4, max_size: 40, preferred_size: 20 }
];

function findOpForQualityName(ops: ReturnType<typeof userOpsSince>, qualityName: string) {
	return ops.find((op) => parseMetadata(op).qualityName === qualityName);
}

/**
 * Context
 *   Base seeded with 'Split QD' containing HDTV-720p and WEBDL-1080p.
 *
 * Submit
 *   Modify both tiers' sizes.
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 2
 *   - one op with metadata.qualityName === 'HDTV-720p'
 *   - one op with metadata.qualityName === 'WEBDL-1080p'
 *   - both ops share the same metadata.group_id
 */
test('representative per-tier modifications split into grouped ops', async () => {
	const ctx = await seededPcd('split-tiers', [
		base.sonarrQualityDefinitions({ name: 'Split QD', entries: SEED_TIERS })
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityDefSonarr.update(ctx, 'Split QD', {
		name: 'Split QD',
		entries: [
			{ quality_name: 'HDTV-720p', min_size: 2, max_size: 18, preferred_size: 10 },
			{ quality_name: 'WEBDL-1080p', min_size: 5, max_size: 45, preferred_size: 22 }
		]
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 2);
	const hdtvOp = findOpForQualityName(ops, 'HDTV-720p');
	const webdlOp = findOpForQualityName(ops, 'WEBDL-1080p');
	assert(hdtvOp, 'expected per-tier op for HDTV-720p');
	assert(webdlOp, 'expected per-tier op for WEBDL-1080p');
	assertSameGroup(ops);
});

/**
 * Context
 *   Base seeded with 'Old QD'.
 *
 * Submit
 *   Rename to 'New QD' AND modify HDTV-720p sizes.
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 2
 *   - one op with changed_fields === ['name'] and previousName === 'Old QD'
 *   - one op with metadata.qualityName === 'HDTV-720p'
 *   - both ops share the same group_id
 */
test('rename plus tier modification emits grouped ops', async () => {
	const ctx = await seededPcd('rename-tier', [
		base.sonarrQualityDefinitions({ name: 'Old QD', entries: SEED_TIERS })
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityDefSonarr.update(ctx, 'Old QD', {
		name: 'New QD',
		entries: [
			{ quality_name: 'HDTV-720p', min_size: 2, max_size: 18, preferred_size: 10 },
			{ quality_name: 'WEBDL-1080p', min_size: 4, max_size: 40, preferred_size: 20 }
		]
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 2);
	const renameOp = opForChangedField(ops, 'name');
	const renameMeta = parseMetadata(renameOp);
	assertEquals(renameMeta.previousName, 'Old QD');
	assertEquals(renameMeta.name, 'New QD');
	assertEquals(parseDesiredState(renameOp).name, { from: 'Old QD', to: 'New QD' });
	const hdtvOp = findOpForQualityName(ops, 'HDTV-720p');
	assert(hdtvOp, 'expected per-tier op for HDTV-720p');
	assertSameGroup(ops);
});

/**
 * Context
 *   Base seeded with 'Pure Rename QD'.
 *
 * Submit
 *   Rename to 'Renamed QD' with no tier changes.
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.changed_fields === ['name']
 *   - op.metadata.previousName === 'Pure Rename QD'
 *   - op.metadata.group_id === undefined
 *   - op.sql is a single UPDATE name=... statement (no DELETE/INSERT)
 */
test('pure rename emits one ungrouped name op', async () => {
	const ctx = await seededPcd('pure-rename', [
		base.sonarrQualityDefinitions({ name: 'Pure Rename QD', entries: SEED_TIERS })
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityDefSonarr.update(ctx, 'Pure Rename QD', {
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
		/update\s+"?sonarr_quality_definitions"?\s+set\s+"?name"?\s*=/i.test(sql),
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
		base.sonarrQualityDefinitions({ name: 'Noop QD', entries: SEED_TIERS })
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityDefSonarr.update(ctx, 'Noop QD', {
		name: 'Noop QD',
		entries: SEED_TIERS
	});

	assertEquals(userOpsSince(ctx, checkpoint).length, 0);
});

await run();
