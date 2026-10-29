import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import type { CommandResult } from '#utils/command.ts';

function importConfig(env: Record<string, string>): CommandResult {
	const base = { ...process.env };
	delete base.AUTH;
	delete base.OIDC_DISCOVERY_URL;
	delete base.OIDC_CLIENT_ID;
	delete base.OIDC_CLIENT_SECRET;

	// runCommand adds to the parent environment and can't unset variables, so
	// spawn directly with the full environment
	const child = spawnSync(
		process.execPath,
		['--input-type=module', '-e', "await import('./src/lib/server/utils/config/config.ts');"],
		{ env: { ...base, ...env } }
	);
	if (child.error) throw child.error;
	return { code: child.status, signal: child.signal, stdout: child.stdout, stderr: child.stderr };
}

test('partial OIDC settings fail config import and name the missing settings', async () => {
	const result = await importConfig({
		AUTH: 'on',
		OIDC_DISCOVERY_URL: 'https://idp.example.com/.well-known/openid-configuration',
		OIDC_CLIENT_ID: 'profilarr'
	});

	expect(result.code).toStrictEqual(1);
	const stderr = new TextDecoder().decode(result.stderr);
	expect(stderr).toContain('OIDC is partially configured. Missing: OIDC_CLIENT_SECRET.');
	// Printed as a log line, not an uncaught error with a stack trace
	expect(stderr).toContain('ERROR');
	expect(stderr).toContain('[Config]');
	expect(!/\n\s+at /.test(stderr), stderr).toBeTruthy();
});

test('partial OIDC settings with AUTH=off do not fail config import', async () => {
	const result = await importConfig({ AUTH: 'off', OIDC_CLIENT_ID: 'profilarr' });
	expect(result.code, new TextDecoder().decode(result.stderr)).toStrictEqual(0);
});
