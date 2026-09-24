/**
 * Tests for outbound proxy detection. The startup log prints this result, so
 * credentials must never make it into the output.
 */

import { assertEquals } from '@std/assert';
import { getProxyEnv } from '$http/proxy.ts';

const envOf = (vars: Record<string, string>) => (name: string) => vars[name];

Deno.test('getProxyEnv: returns nothing when no proxy is set', () => {
	assertEquals(getProxyEnv(envOf({})), { proxies: {}, noProxy: [] });
});

Deno.test('getProxyEnv: masks logins in proxy URLs', () => {
	const result = getProxyEnv(
		envOf({
			HTTPS_PROXY: 'http://user:p%40ss@gluetun:8888',
			ALL_PROXY: 'socks5h://user:secret@proxy:1080'
		})
	);

	assertEquals(result.proxies, {
		HTTPS_PROXY: 'http://***@gluetun:8888',
		ALL_PROXY: 'socks5h://***@proxy:1080'
	});

	const output = JSON.stringify(result);
	for (const secret of ['user', 'p%40ss', 'secret']) {
		assertEquals(output.includes(secret), false, `Output leaked "${secret}": ${output}`);
	}
});

Deno.test('getProxyEnv: leaves proxies without a login unmasked', () => {
	const result = getProxyEnv(envOf({ HTTP_PROXY: 'http://proxy:3128' }));
	assertEquals(result.proxies, { HTTP_PROXY: 'http://proxy:3128' });
});

Deno.test('getProxyEnv: assumes http:// when the scheme is missing', () => {
	const result = getProxyEnv(envOf({ HTTPS_PROXY: 'user:pass@proxy:8080' }));
	assertEquals(result.proxies, { HTTPS_PROXY: 'http://***@proxy:8080' });
});

Deno.test('getProxyEnv: prefers uppercase and falls back to lowercase', () => {
	const result = getProxyEnv(
		envOf({
			HTTPS_PROXY: 'http://upper:8080',
			https_proxy: 'http://lower:8080',
			http_proxy: 'http://lower:3128'
		})
	);

	assertEquals(result.proxies, {
		HTTPS_PROXY: 'http://upper:8080',
		http_proxy: 'http://lower:3128'
	});
});

Deno.test('getProxyEnv: never returns the raw value of an invalid URL', () => {
	const result = getProxyEnv(envOf({ HTTPS_PROXY: 'http://user:secret@[bad' }));

	assertEquals(result.proxies, { HTTPS_PROXY: null });
	assertEquals(JSON.stringify(result).includes('secret'), false);
});

Deno.test('getProxyEnv: splits and trims NO_PROXY', () => {
	const result = getProxyEnv(
		envOf({
			HTTPS_PROXY: 'http://proxy:8080',
			NO_PROXY: ' localhost, 127.0.0.1 ,parser,,192.168.0.0/16 '
		})
	);

	assertEquals(result.noProxy, ['localhost', '127.0.0.1', 'parser', '192.168.0.0/16']);
});
