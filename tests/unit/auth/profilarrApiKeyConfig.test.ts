import process from 'node:process';
import { expect, test } from 'vitest';
import { runCommand } from '#utils/command.ts';

test('PROFILARR_API_KEY shorter than 32 characters fails config import', async () => {
	const result = await runCommand(
		process.execPath,
		['--input-type=module', '-e', "await import('./src/lib/server/utils/config/config.ts');"],
		{ env: { PROFILARR_API_KEY: 'too-short' } }
	);

	expect(result.code).toStrictEqual(1);
	const stderr = new TextDecoder().decode(result.stderr);
	expect(stderr).toContain('PROFILARR_API_KEY must be at least 32 characters long');
	// Printed as a log line, not an uncaught error with a stack trace
	expect(stderr).toContain('ERROR');
	expect(stderr).toContain('[Config]');
	expect(!/\n\s+at /.test(stderr), stderr).toBeTruthy();
});
