/**
 * Tests for outbound proxy detection. The startup log prints this result, so
 * credentials must never make it into the output.
 */

import { expect, test } from 'vitest';
import { getProxyEnv, getSocksProxyError } from '#utils/http/proxy.ts';

const envOf = (vars: Record<string, string>) => (name: string) => vars[name];

test('getProxyEnv: returns nothing when no proxy is set', () => {
	expect(getProxyEnv(envOf({}))).toStrictEqual({ proxies: {}, noProxy: [] });
});

test('getProxyEnv: masks logins in proxy URLs', () => {
	const result = getProxyEnv(
		envOf({
			HTTPS_PROXY: 'http://user:p%40ss@gluetun:8888',
			ALL_PROXY: 'socks5h://user:secret@proxy:1080'
		})
	);

	expect(result.proxies).toStrictEqual({
		HTTPS_PROXY: 'http://***@gluetun:8888',
		ALL_PROXY: 'socks5h://***@proxy:1080'
	});

	const output = JSON.stringify(result);
	for (const secret of ['user', 'p%40ss', 'secret']) {
		expect(output.includes(secret), `Output leaked "${secret}": ${output}`).toStrictEqual(false);
	}
});

test('getProxyEnv: leaves proxies without a login unmasked', () => {
	const result = getProxyEnv(envOf({ HTTP_PROXY: 'http://proxy:3128' }));
	expect(result.proxies).toStrictEqual({ HTTP_PROXY: 'http://proxy:3128' });
});

test('getProxyEnv: assumes http:// when the scheme is missing', () => {
	const result = getProxyEnv(envOf({ HTTPS_PROXY: 'user:pass@proxy:8080' }));
	expect(result.proxies).toStrictEqual({ HTTPS_PROXY: 'http://***@proxy:8080' });
});

test('getProxyEnv: prefers lowercase and falls back to uppercase, as Bun does', () => {
	const result = getProxyEnv(
		envOf({
			HTTPS_PROXY: 'http://upper:8080',
			https_proxy: 'http://lower:8080',
			HTTP_PROXY: 'http://upper:3128'
		})
	);

	expect(result.proxies).toStrictEqual({
		https_proxy: 'http://lower:8080',
		HTTP_PROXY: 'http://upper:3128'
	});
});

test('getProxyEnv: never returns the raw value of an invalid URL', () => {
	const result = getProxyEnv(envOf({ HTTPS_PROXY: 'http://user:secret@[bad' }));

	expect(result.proxies).toStrictEqual({ HTTPS_PROXY: null });
	expect(JSON.stringify(result).includes('secret')).toStrictEqual(false);
});

test('getProxyEnv: splits and trims NO_PROXY', () => {
	const result = getProxyEnv(
		envOf({
			HTTPS_PROXY: 'http://proxy:8080',
			NO_PROXY: ' localhost, 127.0.0.1 ,parser,,192.168.0.0/16 '
		})
	);

	expect(result.noProxy).toStrictEqual(['localhost', '127.0.0.1', 'parser', '192.168.0.0/16']);
});

test('getSocksProxyError: allows HTTP proxies', () => {
	expect(
		getSocksProxyError(
			envOf({
				HTTPS_PROXY: 'http://user:pass@gluetun:8888',
				all_proxy: 'proxy:3128',
				NO_PROXY: 'socks.internal'
			})
		)
	).toStrictEqual(null);
});

test('getSocksProxyError: names every variable that sets a SOCKS proxy', () => {
	const error = getSocksProxyError(
		envOf({
			ALL_PROXY: 'socks5h://user:secret@proxy:1080',
			https_proxy: ' SOCKS5://proxy:1080 ',
			HTTPS_PROXY: 'http://proxy:8888',
			HTTP_PROXY: 'socks4://proxy:1080'
		})
	);

	expect(error).toMatch(/^https_proxy, HTTP_PROXY, ALL_PROXY set a SOCKS proxy/);
	for (const secret of ['user', 'secret', 'proxy:1080']) {
		expect(error?.includes(secret), `Error leaked "${secret}": ${error}`).toStrictEqual(false);
	}
});
