/**
 * PCD write tests: delay profile delete.
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { base } from '../../harness/fixtures.ts';
import {
	normalizeSql,
	opCheckpoint,
	parseDesiredState,
	parseMetadata
} from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import { createScenarioFactory, userOpsSince } from './helpers.ts';

const PORT = 7043;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-delay-profile-delete');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
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
	assertEquals(ops.length, 1);
	const op = ops[0];
	const metadata = parseMetadata(op);
	assertEquals(metadata.operation, 'delete');
	assertEquals(metadata.entity, 'delay_profile');
	assertEquals(metadata.name, 'Delete Delay');
	assertEquals(metadata.changed_fields, ['deleted']);
	const desired = parseDesiredState(op);
	assertEquals(desired.deleted, true);
	assertEquals(desired.name, 'Delete Delay');
	assertEquals(desired.preferred_protocol, 'prefer_torrent');
	assertEquals(desired.usenet_delay, 15);
	assertEquals(desired.torrent_delay, 5);
	assertEquals(desired.bypass_if_highest_quality, true);
	assertEquals(desired.bypass_if_above_custom_format_score, true);
	assertEquals(desired.minimum_custom_format_score, 80);
	assert(/delete from "?delay_profiles"?/i.test(normalizeSql(op.sql)));
});

await run();
