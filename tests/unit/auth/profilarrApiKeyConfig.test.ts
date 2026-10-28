import { test } from 'vitest';
import { assert, assertEquals, assertStringIncludes } from '@std/assert';
import { runCommand } from '$utils/command.ts';

test('PROFILARR_API_KEY shorter than 32 characters fails config import', async () => {
	const result = await runCommand(
		'deno',
		['eval', "await import('./src/lib/server/utils/config/config.ts');"],
		{ env: { PROFILARR_API_KEY: 'too-short' } }
	);

	assertEquals(result.code, 1);
	const stderr = new TextDecoder().decode(result.stderr);
	assertStringIncludes(stderr, 'PROFILARR_API_KEY must be at least 32 characters long');
	// Printed as a log line, not an uncaught error with a stack trace
	assertStringIncludes(stderr, 'ERROR');
	assertStringIncludes(stderr, '[Config]');
	assert(!stderr.includes('Uncaught'), stderr);
});
