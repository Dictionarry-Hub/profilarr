/**
 * Build the golden data folder once per run: an app database with the
 * fixtures seeded and compiled. Each test starts its app on a copy of it.
 * Also makes the run's TLS certificate (harness/tls.ts), and at the end
 * removes any real service containers the run left (harness/docker.ts).
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startApp } from '$flows/harness/app.ts';
import { RUN_ID_ENV, removeRunServices } from '$flows/harness/docker.ts';
import { GOLDEN_DIR_ENV } from '$flows/harness/paths.ts';
import { FIXTURES_NAME, seedFixtures } from '$flows/harness/seed.ts';
import { TLS_DIR_ENV, createCertificate } from '$flows/harness/tls.ts';

export default async function globalSetup(): Promise<() => Promise<void>> {
	// A fresh folder per run; workers read its path from the environment
	const goldenDir = await fs.mkdtemp(join(tmpdir(), 'profilarr-flow-golden-'));
	process.env[GOLDEN_DIR_ENV] = goldenDir;

	const runId = randomUUID();
	process.env[RUN_ID_ENV] = runId;

	const tlsDir = await fs.mkdtemp(join(tmpdir(), 'profilarr-flow-tls-'));
	createCertificate(tlsDir);
	process.env[TLS_DIR_ENV] = tlsDir;

	// First start creates and migrates the app database
	let app = await startApp(goldenDir);
	await app.stop();

	await seedFixtures(goldenDir);

	// Second start imports and compiles the fixtures
	app = await startApp(goldenDir);
	try {
		const status = (await (await fetch(`${app.url}/api/v1/status`)).json()) as {
			databases: { name: string; counts: Record<string, number> }[];
		};
		const fixtures = status.databases.find((db) => db.name === FIXTURES_NAME);
		const compiled = Object.values(fixtures?.counts ?? {}).some((count) => count > 0);
		if (!compiled) {
			throw new Error(`Fixtures didn't compile. Status: ${JSON.stringify(status)}\n${app.logs()}`);
		}
	} finally {
		await app.stop();
	}

	return async () => {
		await fs.rm(goldenDir, { recursive: true, force: true });
		await fs.rm(tlsDir, { recursive: true, force: true });
		await removeRunServices();
		await fs.rm(join(process.cwd(), 'tests/flows/.services', runId), { recursive: true, force: true });
	};
}
