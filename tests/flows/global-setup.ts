/**
 * Build the golden data folder once per run: an app database with the
 * fixtures seeded and compiled. Each test starts its app on a copy of it.
 */

import * as fs from 'node:fs/promises';
import { startApp } from '$flows/helpers/app.ts';
import { GOLDEN_DIR } from '$flows/helpers/paths.ts';
import { FIXTURES_NAME, seedFixtures } from '$flows/helpers/seed.ts';

export default async function globalSetup(): Promise<() => Promise<void>> {
	await fs.rm(GOLDEN_DIR, { recursive: true, force: true });
	await fs.mkdir(GOLDEN_DIR, { recursive: true });

	// First start creates and migrates the app database
	let app = await startApp(GOLDEN_DIR);
	await app.stop();

	await seedFixtures(GOLDEN_DIR);

	// Second start imports and compiles the fixtures
	app = await startApp(GOLDEN_DIR);
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
		await fs.rm(GOLDEN_DIR, { recursive: true, force: true });
	};
}
