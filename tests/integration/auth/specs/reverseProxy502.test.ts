/**
 * Integration tests: Reverse proxy 502 reproduction
 *
 * Backend server on port 7019 with AUTH=on.
 * nginx on :7446 proxies to :7019 with proxy_buffer_size=4k.
 *
 * Expected fixed behavior:
 * - /auth/login works through the proxy
 * - login succeeds
 * - client-side navigation data requests work
 * - a full SSR page load for /databases also works through the proxy
 * - nginx logs do not report "upstream sent too big header"
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect, login } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';

const PORT = 7019;
const PROXY_ORIGIN = 'http://localhost:7446';

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN: PROXY_ORIGIN }, 'preview');
	await createUserDirect(getDbPath(PORT), 'admin', 'password123');
});

teardown(async () => {
	await stopServer(PORT);
});

async function getNginxLogs(): Promise<string> {
	const result = await new Deno.Command('docker', {
		args: [
			'compose',
			'-f',
			'tests/integration/auth/docker-compose.yml',
			'logs',
			'nginx',
			'--tail=50'
		],
		stdout: 'piped',
		stderr: 'piped'
	}).output();

	return new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
}

function getHeaderSizes(headers: Headers): { totalBytes: number; linkBytes: number } {
	let totalBytes = 0;
	let linkBytes = 0;

	for (const [name, value] of headers.entries()) {
		const line = `${name}: ${value}\r\n`;
		const bytes = new TextEncoder().encode(line).length;
		totalBytes += bytes;
		if (name.toLowerCase() === 'link') {
			linkBytes += new TextEncoder().encode(value).length;
		}
	}

	return { totalBytes, linkBytes };
}

function logHeaderSizes(label: string, headers: Headers): void {
	const { totalBytes, linkBytes } = getHeaderSizes(headers);
	console.log(`${label} header bytes: total=${totalBytes}, link=${linkBytes}`);
}

function getRelevantNginxLines(logs: string): string {
	return logs
		.split('\n')
		.filter(
			(line) =>
				line.includes('too big header') ||
				line.includes('"GET /auth/login ') ||
				line.includes('"POST /auth/login ') ||
				line.includes('"GET /databases ') ||
				line.includes('/databases/__data.json')
		)
		.slice(-12)
		.join('\n');
}

test('proxy serves /auth/login normally', async () => {
	const client = new TestClient(PROXY_ORIGIN);
	const res = await client.get('/auth/login');

	logHeaderSizes('/auth/login via nginx', res.headers);
	assertEquals(res.status, 200);
	assertEquals(res.headers.get('x-sveltekit-page'), 'true');
});

test('proxy login succeeds and client-side route data remains accessible', async () => {
	const client = new TestClient(PROXY_ORIGIN);
	const loginRes = await login(client, 'admin', 'password123', PROXY_ORIGIN);

	assertEquals(loginRes.status, 200);

	const dataRes = await client.get('/databases/__data.json');
	logHeaderSizes('/databases/__data.json via nginx', dataRes.headers);
	assertEquals(dataRes.status, 200);
	assertEquals(dataRes.headers.get('content-type'), 'application/json');
});

test('proxy serves full SSR /databases page without upstream header errors', async () => {
	const client = new TestClient(PROXY_ORIGIN);
	await login(client, 'admin', 'password123', PROXY_ORIGIN);

	const directRes = await fetch(`http://localhost:${PORT}/databases`, {
		headers: { Cookie: `session=${client.getCookie('session') ?? ''}` },
		redirect: 'manual'
	});
	logHeaderSizes('/databases direct backend', directRes.headers);

	const res = await client.get('/databases');
	logHeaderSizes('/databases via nginx', res.headers);

	assertEquals(res.status, 200);
	assertEquals(res.headers.get('x-sveltekit-page'), 'true');

	// Give nginx a moment to flush any upstream header error to container logs.
	await new Promise((resolve) => setTimeout(resolve, 200));
	const logs = await getNginxLogs();
	const relevant = getRelevantNginxLines(logs);
	console.log('\nRelevant nginx log lines:');
	console.log(relevant || '(no relevant nginx log lines)');
	if (logs.includes('too big header')) {
		throw new Error('nginx still reports "upstream sent too big header" for /databases');
	}
});

await run();
