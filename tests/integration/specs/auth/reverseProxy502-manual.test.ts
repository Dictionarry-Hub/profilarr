/**
 * Manual integration check: reverse proxy SSR pages work after header fix
 *
 * This spec is intentionally interactive and is skipped in normal
 * integration runs. It needs the auth Docker stack (nginx) running and a
 * human at the terminal. Run it explicitly:
 *
 *   INTEGRATION_MANUAL=1 deno task test:integration tests/integration/specs/auth/reverseProxy502-manual.test.ts
 *
 * It starts:
 * - Profilarr preview on PORTS.auth.reverseProxy502Manual
 * - nginx proxy on :7446 (small proxy_buffer_size)
 *
 * Then it pauses so you can test in a browser and inspect nginx logs after:
 * 1. Login -> client-side navigate to /databases
 * 2. Direct hit to /databases while logged in
 * 3. Login -> navigate to /databases -> manual refresh
 *
 * Expected after the fix:
 * - all three flows work
 * - nginx does not log "upstream sent too big header"
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import { createUserDirect } from '#integration/harness/setup.ts';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';

const PORT = PORTS.auth.reverseProxy502Manual;
const PROXY_ORIGIN = 'http://localhost:7446';
const execFileAsync = promisify(execFile);

async function waitForEnter(message: string): Promise<void> {
	console.log(`\n${message}`);
	console.log('Press Enter to continue...');
	await new Promise<void>((resolve) => {
		process.stdin.once('data', () => {
			process.stdin.pause();
			resolve();
		});
		process.stdin.resume();
	});
}

async function printNginxLogs(label: string): Promise<void> {
	const { stdout, stderr } = await execFileAsync('docker', [
		'compose',
		'-f',
		'tests/integration/specs/auth/docker-compose.yml',
		'logs',
		'nginx',
		'--tail=50'
	]);

	const logs = stdout + stderr;
	const filtered = logs
		.split('\n')
		.filter(
			(line) =>
				line.includes('too big header') ||
				line.includes('"GET /auth/login ') ||
				line.includes('"POST /auth/login ') ||
				line.includes('"GET /databases ') ||
				line.includes('/databases/__data.json') ||
				line.includes('/__data.json?')
		)
		.slice(-20);

	console.log(`\n--- nginx logs after ${label} ---`);
	console.log(filtered.join('\n').trim() || '(no relevant logs)');
	console.log('--- end nginx logs ---\n');
}

describe.skipIf(process.env.INTEGRATION_MANUAL !== '1')('reverse proxy 502 (manual)', () => {
	beforeAll(async () => {
		await startServer(PORT, { AUTH: 'on', ORIGIN: PROXY_ORIGIN }, 'preview');
		await createUserDirect(getDbPath(PORT), 'admin', 'password123');
	});

	afterAll(async () => {
		await stopServer(PORT);
	});

	test('manual repro flow', async () => {
		console.log(`Open ${PROXY_ORIGIN}/auth/login`);
		console.log('Login with: admin / password123');

		await waitForEnter(
			'Step 1: after login, use in-app navigation to reach /databases. Confirm that it works.'
		);
		await printNginxLogs('step 1');

		await waitForEnter(
			'Step 2: while still logged in, go directly to /databases in the address bar (or open it in a new tab). Confirm that it works.'
		);
		await printNginxLogs('step 2');

		await waitForEnter(
			'Step 3: start from /auth/login, navigate to /databases, then refresh the /databases page manually. Confirm that refresh also works.'
		);
		await printNginxLogs('step 3');
	});
});
