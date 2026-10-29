/**
 * PCD write tests: delay profile delete.
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

const PORT = PORTS.pcd.writeDelayProfilesDelete;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-delay-profile-delete');

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

afterAll(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Base layer seeded with one delay profile via base.delayProfile():
 *     name='Delete Delay', preferredProtocol='prefer_torrent',
 *     usenetDelay=15, torrentDelay=5, bypassIfHighestQuality=true,
 *     bypassIfAboveCfScore=true, minimumCfScore=80
 *   Compiled.
 *
 * Submit
 *   POST /delay-profiles/{ctx.dbId}/Delete%20Delay?/delete with form fields:
 *     layer = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.operation      === 'delete'
 *   - op.metadata.entity         === 'delay_profile'
 *   - op.metadata.name           === 'Delete Delay'
 *   - op.metadata.changed_fields === ['deleted']
 *   - op.desired_state.deleted   === true
 *   - op.desired_state.name      === 'Delete Delay'
 *   - op.desired_state.preferred_protocol === 'prefer_torrent'
 *   - op.desired_state.usenet_delay       === 15
 *   - op.desired_state.torrent_delay      === 5
 *   - op.desired_state.minimum_custom_format_score === 80
 *   - op.sql matches /delete from "?delay_profiles"?/i
 */
test('delay profile emits one delete op', async () => {
	const ctx = await seededPcd('simple', [
		base.delayProfile({
			name: 'Delete Delay',
			preferredProtocol: 'prefer_torrent',
			usenetDelay: 15,
			torrentDelay: 5,
			bypassIfHighestQuality: true,
			bypassIfAboveCfScore: true,
			minimumCfScore: 80
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.delayProfile.remove(ctx, 'Delete Delay');

	const ops = userOpsSince(ctx, checkpoint);
	expect(ops.length).toStrictEqual(1);
	const op = ops[0];
	const metadata = parseMetadata(op);
	expect(metadata.operation).toStrictEqual('delete');
	expect(metadata.entity).toStrictEqual('delay_profile');
	expect(metadata.name).toStrictEqual('Delete Delay');
	expect(metadata.changed_fields).toStrictEqual(['deleted']);
	const desired = parseDesiredState(op);
	expect(desired.deleted).toStrictEqual(true);
	expect(desired.name).toStrictEqual('Delete Delay');
	expect(desired.preferred_protocol).toStrictEqual('prefer_torrent');
	expect(desired.usenet_delay).toStrictEqual(15);
	expect(desired.torrent_delay).toStrictEqual(5);
	expect(desired.bypass_if_highest_quality).toStrictEqual(true);
	expect(desired.bypass_if_above_custom_format_score).toStrictEqual(true);
	expect(desired.minimum_custom_format_score).toStrictEqual(80);
	expect(/delete from "?delay_profiles"?/i.test(normalizeSql(op.sql))).toBeTruthy();
});
