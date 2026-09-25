import { assert, assertEquals, assertStringIncludes } from '@std/assert';

async function importConfig(env: Record<string, string>): Promise<Deno.CommandOutput> {
	const base = Deno.env.toObject();
	delete base.AUTH;
	delete base.OIDC_DISCOVERY_URL;
	delete base.OIDC_CLIENT_ID;
	delete base.OIDC_CLIENT_SECRET;

	return await new Deno.Command('deno', {
		args: ['eval', "await import('./src/lib/server/utils/config/config.ts');"],
		env: { ...base, ...env },
		clearEnv: true,
		stdout: 'piped',
		stderr: 'piped'
	}).output();
}

Deno.test('partial OIDC settings fail config import and name the missing settings', async () => {
	const result = await importConfig({
		AUTH: 'on',
		OIDC_DISCOVERY_URL: 'https://idp.example.com/.well-known/openid-configuration',
		OIDC_CLIENT_ID: 'profilarr'
	});

	assertEquals(result.code, 1);
	const stderr = new TextDecoder().decode(result.stderr);
	assertStringIncludes(stderr, 'OIDC is partially configured. Missing: OIDC_CLIENT_SECRET.');
	// Printed as a log line, not an uncaught error with a stack trace
	assertStringIncludes(stderr, 'ERROR');
	assertStringIncludes(stderr, '[Config]');
	assert(!stderr.includes('Uncaught'), stderr);
});

Deno.test('partial OIDC settings with AUTH=off do not fail config import', async () => {
	const result = await importConfig({ AUTH: 'off', OIDC_CLIENT_ID: 'profilarr' });
	assertEquals(result.code, 0, new TextDecoder().decode(result.stderr));
});
