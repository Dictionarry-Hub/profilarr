/**
 * PCD write tests: delay profile update.
 */

import { assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import { opCheckpoint, parseDesiredState, parseMetadata } from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import {
	assertOnlyField,
	assertSameGroup,
	createScenarioFactory,
	opForChangedField,
	opForChangedFields,
	userOpsSince
} from './helpers.ts';

const PORT = PORTS.pcd.writeDelayProfilesUpdate;
const ORIGIN = `http://localhost:${PORT}`;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-delay-profile-update');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Base layer seeded with one delay profile via base.delayProfile():
 *     name='Split Profile', preferredProtocol='prefer_usenet',
 *     usenetDelay=10, torrentDelay=20, bypassIfHighestQuality=false,
 *     bypassIfAboveCfScore=true, minimumCfScore=100
 *   Compiled.
 *
 * Submit
 *   POST /delay-profiles/{ctx.dbId}/Split%20Profile?/update with form fields:
 *     name                     = 'Split Profile'      // unchanged
 *     preferredProtocol        = 'prefer_torrent'     // changed, standalone-valid
 *     usenetDelay              = '15'                 // changed
 *     torrentDelay             = '25'                 // changed
 *     bypassIfHighestQuality   = 'true'               // changed
 *     bypassIfAboveCfScore     = 'true'               // unchanged
 *     minimumCfScore           = '125'                // changed
 *     layer                    = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 5
 *   - one op with metadata.changed_fields === ['preferred_protocol']
 *   - one op with metadata.changed_fields === ['usenet_delay']
 *   - one op with metadata.changed_fields === ['torrent_delay']
 *   - one op with metadata.changed_fields === ['bypass_if_highest_quality']
 *   - one op with metadata.changed_fields === ['minimum_custom_format_score']
 *   - all five ops share the same metadata.group_id
 */
test('independent scalar fields split into grouped ops', async () => {
	const ctx = await seededPcd('scalars', [
		base.delayProfile({
			name: 'Split Profile',
			preferredProtocol: 'prefer_usenet',
			usenetDelay: 10,
			torrentDelay: 20,
			bypassIfHighestQuality: false,
			bypassIfAboveCfScore: true,
			minimumCfScore: 100
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.delayProfile.update(ctx, 'Split Profile', {
		name: 'Split Profile',
		preferredProtocol: 'prefer_torrent',
		usenetDelay: 15,
		torrentDelay: 25,
		bypassIfHighestQuality: true,
		bypassIfAboveCfScore: true,
		minimumCfScore: 125
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 5);
	assertOnlyField(ops, 'preferred_protocol');
	assertOnlyField(ops, 'usenet_delay');
	assertOnlyField(ops, 'torrent_delay');
	assertOnlyField(ops, 'bypass_if_highest_quality');
	assertOnlyField(ops, 'minimum_custom_format_score');
	assertSameGroup(ops);
});

/**
 * Context
 *   Base layer seeded with one delay profile via base.delayProfile():
 *     name='Old Delay', preferredProtocol='prefer_usenet',
 *     usenetDelay=0, torrentDelay=30
 *   Compiled.
 *
 * Submit
 *   POST /delay-profiles/{ctx.dbId}/Old%20Delay?/update with form fields:
 *     name                     = 'New Delay'       // changed
 *     preferredProtocol        = 'prefer_usenet'   // unchanged
 *     usenetDelay              = '0'               // unchanged
 *     torrentDelay             = '45'              // changed
 *     bypassIfHighestQuality   = 'false'
 *     bypassIfAboveCfScore     = 'false'
 *     minimumCfScore           = '0'
 *     layer                    = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 2
 *   - one op with metadata.changed_fields === ['torrent_delay']
 *   - one op with metadata.changed_fields === ['name']
 *   - both ops share the same metadata.group_id
 *   - rename op.metadata.name         === 'New Delay'
 *   - rename op.metadata.previousName === 'Old Delay'
 *   - rename op.desired_state.name    === { from: 'Old Delay', to: 'New Delay' }
 */
test('rename plus scalar change emits grouped split ops', async () => {
	const ctx = await seededPcd('rename-scalar', [
		base.delayProfile({
			name: 'Old Delay',
			preferredProtocol: 'prefer_usenet',
			usenetDelay: 0,
			torrentDelay: 30
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.delayProfile.update(ctx, 'Old Delay', {
		name: 'New Delay',
		preferredProtocol: 'prefer_usenet',
		usenetDelay: 0,
		torrentDelay: 45,
		bypassIfHighestQuality: false,
		bypassIfAboveCfScore: false,
		minimumCfScore: 0
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 2);
	assertOnlyField(ops, 'torrent_delay');
	assertOnlyField(ops, 'name');
	assertSameGroup(ops);
	const renameOp = opForChangedField(ops, 'name');
	const metadata = parseMetadata(renameOp);
	assertEquals(metadata.name, 'New Delay');
	assertEquals(metadata.previousName, 'Old Delay');
	assertEquals(parseDesiredState(renameOp).name, { from: 'Old Delay', to: 'New Delay' });
});

/**
 * Context
 *   Base layer seeded with one delay profile via base.delayProfile():
 *     name='Pure Rename Delay', preferredProtocol='prefer_usenet',
 *     usenetDelay=0, torrentDelay=30
 *   Compiled.
 *
 * Submit
 *   POST /delay-profiles/{ctx.dbId}/Pure%20Rename%20Delay?/update with form fields:
 *     name                     = 'Renamed Delay'   // changed
 *     preferredProtocol        = 'prefer_usenet'
 *     usenetDelay              = '0'
 *     torrentDelay             = '30'
 *     bypassIfHighestQuality   = 'false'
 *     bypassIfAboveCfScore     = 'false'
 *     minimumCfScore           = '0'
 *     layer                    = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.changed_fields === ['name']
 *   - op.metadata.group_id      === undefined
 *   - op.metadata.name          === 'Renamed Delay'
 *   - op.metadata.previousName  === 'Pure Rename Delay'
 *   - op.desired_state.name     === { from: 'Pure Rename Delay', to: 'Renamed Delay' }
 */
test('pure rename emits one ungrouped rename op', async () => {
	const ctx = await seededPcd('pure-rename', [
		base.delayProfile({
			name: 'Pure Rename Delay',
			preferredProtocol: 'prefer_usenet',
			usenetDelay: 0,
			torrentDelay: 30
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.delayProfile.update(ctx, 'Pure Rename Delay', {
		name: 'Renamed Delay',
		preferredProtocol: 'prefer_usenet',
		usenetDelay: 0,
		torrentDelay: 30,
		bypassIfHighestQuality: false,
		bypassIfAboveCfScore: false,
		minimumCfScore: 0
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const renameOp = opForChangedField(ops, 'name');
	const metadata = parseMetadata(renameOp);
	assertEquals(metadata.group_id, undefined);
	assertEquals(metadata.name, 'Renamed Delay');
	assertEquals(metadata.previousName, 'Pure Rename Delay');
	assertEquals(parseDesiredState(renameOp).name, {
		from: 'Pure Rename Delay',
		to: 'Renamed Delay'
	});
});

/**
 * Context
 *   Base layer seeded with one delay profile via base.delayProfile():
 *     name='Torrent Only Profile', preferredProtocol='prefer_usenet',
 *     usenetDelay=10, torrentDelay=20
 *   Compiled.
 *
 * Submit
 *   POST /delay-profiles/{ctx.dbId}/Torrent%20Only%20Profile?/update with form fields:
 *     name                     = 'Torrent Only Profile'
 *     preferredProtocol        = 'only_torrent'    // changed
 *     usenetDelay              = '10'              // ignored by writer, stored as NULL
 *     torrentDelay             = '20'
 *     bypassIfHighestQuality   = 'false'
 *     bypassIfAboveCfScore     = 'false'
 *     minimumCfScore           = '0'
 *     layer                    = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.changed_fields === ['preferred_protocol', 'usenet_delay']
 *   - op.desired_state.preferred_protocol === { from: 'prefer_usenet', to: 'only_torrent' }
 *   - op.desired_state.usenet_delay       === { from: 10, to: null }
 *
 * Note: preferred_protocol and usenet_delay must stay in one op because the
 * schema check requires usenet_delay to be NULL for only_torrent.
 */
test('protocol nulling writes a constrained paired op', async () => {
	const ctx = await seededPcd('protocol-nulling', [
		base.delayProfile({
			name: 'Torrent Only Profile',
			preferredProtocol: 'prefer_usenet',
			usenetDelay: 10,
			torrentDelay: 20
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.delayProfile.update(ctx, 'Torrent Only Profile', {
		name: 'Torrent Only Profile',
		preferredProtocol: 'only_torrent',
		usenetDelay: 10,
		torrentDelay: 20,
		bypassIfHighestQuality: false,
		bypassIfAboveCfScore: false,
		minimumCfScore: 0
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = opForChangedFields(ops, ['preferred_protocol', 'usenet_delay']);
	const desired = parseDesiredState(op);
	assertEquals(desired.preferred_protocol, {
		from: 'prefer_usenet',
		to: 'only_torrent'
	});
	assertEquals(desired.usenet_delay, { from: 10, to: null });
});

/**
 * Context
 *   Base layer seeded with one delay profile via base.delayProfile():
 *     name='Bypass Score Profile', preferredProtocol='prefer_usenet',
 *     usenetDelay=0, torrentDelay=0, bypassIfAboveCfScore=true,
 *     minimumCfScore=80
 *   Compiled.
 *
 * Submit
 *   POST /delay-profiles/{ctx.dbId}/Bypass%20Score%20Profile?/update with form fields:
 *     name                     = 'Bypass Score Profile'
 *     preferredProtocol        = 'prefer_usenet'
 *     usenetDelay              = '0'
 *     torrentDelay             = '0'
 *     bypassIfHighestQuality   = 'false'
 *     bypassIfAboveCfScore     = 'false'    // changed
 *     minimumCfScore           = '80'       // ignored by writer, stored as NULL
 *     layer                    = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.changed_fields === [
 *       'bypass_if_above_custom_format_score',
 *       'minimum_custom_format_score'
 *     ]
 *   - op.desired_state.bypass_if_above_custom_format_score === { from: true, to: false }
 *   - op.desired_state.minimum_custom_format_score          === { from: 80, to: null }
 *
 * Note: bypass_if_above_custom_format_score and minimum_custom_format_score
 * must stay in one op because the schema check requires NULL score when
 * bypass is disabled.
 */
test('disabling bypass score writes a constrained paired op', async () => {
	const ctx = await seededPcd('bypass-nulling', [
		base.delayProfile({
			name: 'Bypass Score Profile',
			preferredProtocol: 'prefer_usenet',
			usenetDelay: 0,
			torrentDelay: 0,
			bypassIfHighestQuality: false,
			bypassIfAboveCfScore: true,
			minimumCfScore: 80
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.delayProfile.update(ctx, 'Bypass Score Profile', {
		name: 'Bypass Score Profile',
		preferredProtocol: 'prefer_usenet',
		usenetDelay: 0,
		torrentDelay: 0,
		bypassIfHighestQuality: false,
		bypassIfAboveCfScore: false,
		minimumCfScore: 80
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 1);
	const op = opForChangedFields(ops, [
		'bypass_if_above_custom_format_score',
		'minimum_custom_format_score'
	]);
	const desired = parseDesiredState(op);
	assertEquals(desired.bypass_if_above_custom_format_score, { from: true, to: false });
	assertEquals(desired.minimum_custom_format_score, { from: 80, to: null });
});

/**
 * Context
 *   Base layer seeded with one delay profile via base.delayProfile():
 *     name='Noop Delay', preferredProtocol='prefer_usenet',
 *     usenetDelay=0, torrentDelay=0
 *   Compiled.
 *
 * Submit
 *   POST /delay-profiles/{ctx.dbId}/Noop%20Delay?/update with form fields:
 *     name                     = 'Noop Delay'
 *     preferredProtocol        = 'prefer_usenet'
 *     usenetDelay              = '0'
 *     torrentDelay             = '0'
 *     bypassIfHighestQuality   = 'false'
 *     bypassIfAboveCfScore     = 'false'
 *     minimumCfScore           = '0'
 *     layer                    = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 0
 */
test('unchanged submit writes no ops', async () => {
	const ctx = await seededPcd('noop', [
		base.delayProfile({
			name: 'Noop Delay',
			preferredProtocol: 'prefer_usenet',
			usenetDelay: 0,
			torrentDelay: 0
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.delayProfile.update(ctx, 'Noop Delay', {
		name: 'Noop Delay',
		preferredProtocol: 'prefer_usenet',
		usenetDelay: 0,
		torrentDelay: 0,
		bypassIfHighestQuality: false,
		bypassIfAboveCfScore: false,
		minimumCfScore: 0
	});

	assertEquals(userOpsSince(ctx, checkpoint).length, 0);
});

await run();
