/**
 * PCD write tests: custom format conditions.
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../../harness/fixtures.ts';
import { opCheckpoint } from '../../harness/pcd.ts';
import { write } from '../../harness/write.ts';
import { createScenarioFactory, userOpsSince } from '../regex/helpers.ts';
import type { ConditionData } from '$shared/pcd/display.ts';

const PORT = PORTS.pcd.writeCustomFormatConditions;
const ORIGIN = `http://localhost:${PORT}`;
const GB = 1024 * 1024 * 1024;

const { seededPcd } = createScenarioFactory(PORT, 'pcd-write-custom-format-conditions');

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Base layer seeded with one custom format.
 *
 * Submit
 *   POST /custom-formats/{ctx.dbId}/{id}/conditions?/update with:
 *     condition.type = 'size'
 *     condition.size.minBytes = 2 GiB
 *     condition.size.maxBytes = 1 GiB
 *
 * Expect
 *   - response is a SvelteKit form failure
 *   - body contains "Max size must be greater than min size."
 *   - no user ops are written
 */
test('invalid size condition range fails without writing ops', async () => {
	const ctx = await seededPcd('invalid-size-range', [
		base.customFormat({ name: 'Size Format' })
	]);
	const checkpoint = opCheckpoint(ctx);

	const response = await write.customFormat.submitUpdateConditions(ctx, 1, [
		sizeCondition({
			minBytes: 2 * GB,
			maxBytes: GB
		})
	]);

	const body = await response.text();
	assert(
		response.status >= 400 || body.includes('"type":"failure"'),
		`Expected form action failure, got status=${response.status} body=${body}`
	);
	assert(body.includes('Max size must be greater than min size.'));
	assertEquals(userOpsSince(ctx, checkpoint).length, 0);
});

function sizeCondition(size: {
	minBytes: number | null;
	maxBytes: number | null;
}): ConditionData {
	return {
		name: 'Size',
		type: 'size',
		arrType: 'all',
		negate: false,
		required: false,
		size
	};
}

await run();
