/**
 * Vitest setupFiles entry for the integration suite. Runs in each spec file's
 * worker before the spec, so these hooks attach to the spec's file suite.
 *
 * - afterEach: when a test fails, dump the captured output of any server
 *   that has already exited, so a crash shows up next to the failure.
 * - afterAll: when the spec's beforeAll failed, dump every server's output.
 *   The config sets `sequence.hooks: 'list'`, so this runs before the spec's
 *   own afterAll stops its servers.
 */

import { afterAll, afterEach } from 'vitest';
import { dumpAllServerDiagnostics, dumpDeadServerDiagnostics } from './server.ts';

afterEach((context) => {
	if (context.task.result?.state === 'fail') {
		dumpDeadServerDiagnostics('server crashed during test');
	}
});

// Vitest requires the first hook argument to be a destructuring pattern, even
// when only the suite (second argument) is used.
afterAll(({}, suite) => {
	// Test failures only mark the suite failed after afterAll; this state is
	// set during the hooks only when beforeAll threw.
	if (suite.result?.state === 'fail') {
		dumpAllServerDiagnostics('after setup failure');
	}
});
