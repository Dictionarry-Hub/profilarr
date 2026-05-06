/**
 * PCD write tests: radarr quality definitions delete.
 *
 * The name-only-guard SQL assertion will fail until the delete writer is
 * converted to a single name-only DELETE statement (covered by task #14).
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import { normalizeSql, opCheckpoint, parseDesiredState, parseMetadata } from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import { createScenarioFactory, userOpsSince } from './helpers.ts';

const PORT = PORTS.pcd.writeQualityDefinitionsRadarrDelete;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-quality-def-radarr-delete');

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

/**
 * Context
 *   Base seeded with 'Delete QD' containing two tiers.
 *
 * Submit
 *   POST .../radarr/Delete%20QD?/delete with layer='user'.
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.operation === 'delete'
 *   - op.metadata.entity === 'radarr_quality_definitions'
 *   - op.metadata.changed_fields === ['deleted']
 *   - op.desired_state.deleted === true
 *   - op.desired_state.name === 'Delete QD'
 *   - op.sql is a single DELETE FROM radarr_quality_definitions WHERE name = ?
 *     (no quality_name, min_size, max_size, preferred_size in WHERE)
 *     Currently fails until #14 converts to name-only single-statement delete.
 */
test('radarr quality definitions delete emits one name-guarded op', async () => {
	const ctx = await seededPcd('simple', [
		base.radarrQualityDefinitions({ name: 'Delete QD', entries: SEED_TIERS })
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityDefRadarr.remove(ctx, 'Delete QD');

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = ops[0];
	const metadata = parseMetadata(op);
	assertEquals(metadata.operation, 'delete');
	assertEquals(metadata.entity, 'radarr_quality_definitions');
	assertEquals(metadata.changed_fields, ['deleted']);
	const desired = parseDesiredState(op);
	assertEquals(desired.deleted, true);
	assertEquals(desired.name, 'Delete QD');

	const sql = normalizeSql(op.sql);
	const lowerSql = sql.toLowerCase();
	assert(/delete from "?radarr_quality_definitions"?/i.test(sql));

	const deleteIndex = lowerSql.indexOf('delete from "radarr_quality_definitions"');
	assert(deleteIndex >= 0, 'expected radarr_quality_definitions delete in SQL');
	const deleteClause = sql.slice(deleteIndex);
	assert(/where "?name"? = /i.test(deleteClause));

	const forbidden = ['quality_name', 'min_size', 'max_size', 'preferred_size'];
	for (const field of forbidden) {
		const pattern = new RegExp(`where[^;]*"?${field}"?\\s*=`, 'i');
		assert(
			!pattern.test(deleteClause),
			`${field} should not appear in delete WHERE clause, got: ${deleteClause}`
		);
	}
});

await run();
