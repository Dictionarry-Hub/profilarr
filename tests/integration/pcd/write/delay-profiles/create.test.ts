/**
 * PCD write tests: delay profile create.
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import {
	compilePcd,
	normalizeSql,
	opCheckpoint,
	parseDesiredState,
	parseMetadata
} from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import { assertActionFailed, createScenarioFactory, userOpsSince } from './helpers.ts';

const PORT = PORTS.pcd.writeDelayProfilesCreate;
const ORIGIN = `http://localhost:${PORT}`;

const { newPcd, seededPcd } = createScenarioFactory(PORT, 'pcd-write-delay-profile-create');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /delay-profiles/{ctx.dbId}/new with form fields:
 *     name                     = 'Created Delay'
 *     preferredProtocol        = 'prefer_usenet'
 *     usenetDelay              = '0'
 *     torrentDelay             = '0'
 *     bypassIfHighestQuality   = 'false'
 *     bypassIfAboveCfScore     = 'false'
 *     minimumCfScore           = '0'
 *     layer                    = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.operation === 'create'
 *   - op.metadata.entity    === 'delay_profile'
 *   - op.metadata.name      === 'Created Delay'
 *   - op.desired_state.name === 'Created Delay'
 *   - op.desired_state.preferred_protocol === 'prefer_usenet'
 *   - op.desired_state.usenet_delay       === 0
 *   - op.desired_state.torrent_delay      === 0
 *   - op.desired_state.minimum_custom_format_score === null
 *   - op.sql matches /insert into "?delay_profiles"?/i
 */
test('minimal delay profile emits one create op', async () => {
	const ctx = await newPcd('minimal');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	await write.delayProfile.create(ctx, {
		name: 'Created Delay'
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = ops[0];
	const metadata = parseMetadata(op);
	assertEquals(metadata.operation, 'create');
	assertEquals(metadata.entity, 'delay_profile');
	assertEquals(metadata.name, 'Created Delay');
	const desired = parseDesiredState(op);
	assertEquals(desired.name, 'Created Delay');
	assertEquals(desired.preferred_protocol, 'prefer_usenet');
	assertEquals(desired.usenet_delay, 0);
	assertEquals(desired.torrent_delay, 0);
	assertEquals(desired.bypass_if_highest_quality, false);
	assertEquals(desired.bypass_if_above_custom_format_score, false);
	assertEquals(desired.minimum_custom_format_score, null);
	assert(/insert into "?delay_profiles"?/i.test(normalizeSql(op.sql)));
});

/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /delay-profiles/{ctx.dbId}/new with form fields:
 *     name                     = 'Torrent Only Create'
 *     preferredProtocol        = 'only_torrent'
 *     usenetDelay              = '30'      // ignored by writer, stored as NULL
 *     torrentDelay             = '10'
 *     bypassIfHighestQuality   = 'false'
 *     bypassIfAboveCfScore     = 'false'
 *     minimumCfScore           = '0'
 *     layer                    = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.desired_state.preferred_protocol === 'only_torrent'
 *   - op.desired_state.usenet_delay       === null
 *   - op.desired_state.torrent_delay      === 10
 */
test('protocol-constrained create stores ignored delay as null', async () => {
	const ctx = await newPcd('protocol-constrained');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	await write.delayProfile.create(ctx, {
		name: 'Torrent Only Create',
		preferredProtocol: 'only_torrent',
		usenetDelay: 30,
		torrentDelay: 10
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const desired = parseDesiredState(ops[0]);
	assertEquals(desired.preferred_protocol, 'only_torrent');
	assertEquals(desired.usenet_delay, null);
	assertEquals(desired.torrent_delay, 10);
});

/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /delay-profiles/{ctx.dbId}/new with form fields:
 *     name                     = 'Score Disabled Create'
 *     preferredProtocol        = 'prefer_usenet'
 *     usenetDelay              = '0'
 *     torrentDelay             = '0'
 *     bypassIfHighestQuality   = 'false'
 *     bypassIfAboveCfScore     = 'false'
 *     minimumCfScore           = '80'      // ignored by writer, stored as NULL
 *     layer                    = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.desired_state.bypass_if_above_custom_format_score === false
 *   - op.desired_state.minimum_custom_format_score          === null
 */
test('bypass-score-disabled create stores score as null', async () => {
	const ctx = await newPcd('bypass-score-disabled');
	await compilePcd(ctx);
	const checkpoint = opCheckpoint(ctx);

	await write.delayProfile.create(ctx, {
		name: 'Score Disabled Create',
		minimumCfScore: 80
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const desired = parseDesiredState(ops[0]);
	assertEquals(desired.bypass_if_above_custom_format_score, false);
	assertEquals(desired.minimum_custom_format_score, null);
});

/**
 * Context
 *   Base layer seeded with one delay profile via base.delayProfile():
 *     name='Existing Delay'
 *   Compiled so it is in the cache.
 *
 * Submit
 *   POST /delay-profiles/{ctx.dbId}/new with form fields:
 *     name                     = 'existing delay'   // lowercase variant of the seeded name
 *     preferredProtocol        = 'prefer_usenet'
 *     usenetDelay              = '0'
 *     torrentDelay             = '0'
 *     bypassIfHighestQuality   = 'false'
 *     bypassIfAboveCfScore     = 'false'
 *     minimumCfScore           = '0'
 *     layer                    = 'user'
 *
 * Expect
 *   - response.status >= 400 OR body contains '"type":"failure"'
 *   - userOpsSince(checkpoint).length === 0
 */
test('duplicate name fails without writing ops', async () => {
	const ctx = await seededPcd('duplicate', [base.delayProfile({ name: 'Existing Delay' })]);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.delayProfile.submitCreate(ctx, {
		name: 'existing delay'
	});

	await assertActionFailed(response);
	assertEquals(userOpsSince(ctx, checkpoint).length, 0);
});

await run();
