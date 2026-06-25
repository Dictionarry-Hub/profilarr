import { assertEquals, assertStringIncludes } from '@std/assert';

Deno.test('PROFILARR_API_KEY shorter than 32 characters fails config import', async () => {
	const result = await new Deno.Command('deno', {
		args: ['eval', "await import('./src/lib/server/utils/config/config.ts');"],
		env: { ...Deno.env.toObject(), PROFILARR_API_KEY: 'too-short' },
		stdout: 'piped',
		stderr: 'piped'
	}).output();

	assertEquals(result.code, 1);
	assertStringIncludes(
		new TextDecoder().decode(result.stderr),
		'PROFILARR_API_KEY must be at least 32 characters long'
	);
});
