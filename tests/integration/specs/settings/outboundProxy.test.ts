/**
 * Integration tests: outbound proxy variables at startup
 *
 * Bun's fetch can't use a SOCKS proxy, so the server refuses to start when a
 * proxy variable sets one, instead of failing requests or skipping the proxy.
 *
 * Tests:
 * 1. A SOCKS proxy in ALL_PROXY stops startup with an error that leaves out the login
 * 2. An HTTP proxy starts normally
 */

import { getServerOutput, startServer, stopServer } from '#integration/harness/server.ts';
import { afterAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';

const SOCKS_PORT = PORTS.settings.outboundProxySocks;
const HTTP_PORT = PORTS.settings.outboundProxyHttp;
const origin = (port: number) => `http://localhost:${port}`;

afterAll(async () => {
	await Promise.all([SOCKS_PORT, HTTP_PORT].map((port) => stopServer(port)));
});

test('refuses to start with a SOCKS proxy', async () => {
	let started = false;
	try {
		await startServer(
			SOCKS_PORT,
			{
				AUTH: 'off',
				ORIGIN: origin(SOCKS_PORT),
				ALL_PROXY: 'socks5h://user:secret@proxy.invalid:1080'
			},
			'preview'
		);
		started = true;
	} catch {
		// Expected: the process exits before its health check passes
	}
	expect(!started, 'Server should refuse to start').toBeTruthy();

	const output = getServerOutput(SOCKS_PORT);
	expect(output).toContain("ALL_PROXY sets a SOCKS proxy, which Profilarr can't use");
	expect(output.includes('secret'), 'The proxy login must not reach the output').toStrictEqual(
		false
	);
});

test('starts with an HTTP proxy', async () => {
	await startServer(
		HTTP_PORT,
		{
			AUTH: 'off',
			ORIGIN: origin(HTTP_PORT),
			HTTPS_PROXY: 'http://proxy.invalid:8888',
			NO_PROXY: 'localhost'
		},
		'preview'
	);

	const res = await fetch(`${origin(HTTP_PORT)}/api/v1/health`);
	expect(res.status, 'An HTTP proxy should not stop startup').toStrictEqual(200);
});
