/**
 * Manual integration check: reverse proxy SSR pages work after header fix
 *
 * This spec is intentionally interactive and is excluded from normal
 * `deno task test integration` runs. Run it explicitly:
 *
 *   deno task test integration reverseProxy502-manual
 *
 * It starts:
 * - Profilarr preview on :7019
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

import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect } from '$test-harness/setup.ts';
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

async function waitForEnter(message: string): Promise<void> {
	console.log(`\n${message}`);
	console.log('Press Enter to continue...');
	await Deno.stdin.read(new Uint8Array(1024));
}

async function printNginxLogs(label: string): Promise<void> {
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

	const logs = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
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

await run();
