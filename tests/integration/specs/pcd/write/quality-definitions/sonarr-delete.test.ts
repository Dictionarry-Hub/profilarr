/**
 * PCD write tests: sonarr quality definitions delete.
 *
 * The name-only-guard SQL assertion will fail until the delete writer is
 * converted to a single name-only DELETE statement (covered by task #14).
 */

import { startServer, stopServer } from '#integration/harness/server.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { base } from '#integration/specs/pcd/harness/fixtures.ts';
import {
	normalizeSql,
	opCheckpoint,
	parseDesiredState,
	parseMetadata
} from '#integration/specs/pcd/harness/pcd.ts';
import { write } from '#integration/specs/pcd/harness/write.ts';
import { createScenarioFactory, userOpsSince } from './helpers.ts';

const PORT = PORTS.pcd.writeQualityDefinitionsSonarrDelete;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-quality-def-sonarr-delete');

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

afterAll(async () => {
	await stopServer(PORT);
});

const SEED_TIERS = [
	{ quality_name: 'HDTV-720p', min_size: 1, max_size: 15, preferred_size: 8 },
	{ quality_name: 'WEBDL-1080p', min_size: 4, max_size: 40, preferred_size: 20 }
];

/**
 * Context
 *   Base seeded with 'Delete QD' containing two tiers.
 *
 * Submit
 *   POST .../sonarr/Delete%20QD?/delete with layer='user'.
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.operation === 'delete'
 *   - op.metadata.entity === 'sonarr_quality_definitions'
 *   - op.metadata.changed_fields === ['deleted']
 *   - op.desired_state.deleted === true
 *   - op.desired_state.name === 'Delete QD'
 *   - op.sql is a single DELETE FROM sonarr_quality_definitions WHERE name = ?
 *     Currently fails until #14 converts to name-only single-statement delete.
 */
test('sonarr quality definitions delete emits one name-guarded op', async () => {
	const ctx = await seededPcd('simple', [
		base.sonarrQualityDefinitions({ name: 'Delete QD', entries: SEED_TIERS })
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.qualityDefSonarr.remove(ctx, 'Delete QD');

	const ops = userOpsSince(ctx, checkpoint);
	expect(ops.length).toStrictEqual(1);
	const op = ops[0];
	const metadata = parseMetadata(op);
	expect(metadata.operation).toStrictEqual('delete');
	expect(metadata.entity).toStrictEqual('sonarr_quality_definitions');
	expect(metadata.changed_fields).toStrictEqual(['deleted']);
	const desired = parseDesiredState(op);
	expect(desired.deleted).toStrictEqual(true);
	expect(desired.name).toStrictEqual('Delete QD');

	const sql = normalizeSql(op.sql);
	const lowerSql = sql.toLowerCase();
	expect(/delete from "?sonarr_quality_definitions"?/i.test(sql)).toBeTruthy();

	const deleteIndex = lowerSql.indexOf('delete from "sonarr_quality_definitions"');
	expect(deleteIndex >= 0, 'expected sonarr_quality_definitions delete in SQL').toBeTruthy();
	const deleteClause = sql.slice(deleteIndex);
	expect(/where "?name"? = /i.test(deleteClause)).toBeTruthy();

	const forbidden = ['quality_name', 'min_size', 'max_size', 'preferred_size'];
	for (const field of forbidden) {
		const pattern = new RegExp(`where[^;]*"?${field}"?\\s*=`, 'i');
		expect(
			!pattern.test(deleteClause),
			`${field} should not appear in delete WHERE clause, got: ${deleteClause}`
		).toBeTruthy();
	}
});
