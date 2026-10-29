/**
 * Paths the flow suite uses. All relative to the repo root, which is the
 * working directory both on the host and inside the Playwright container.
 */

import { resolve } from 'node:path';

const ROOT = process.cwd();

/** The compiled app, built by `pnpm build` */
export const APP_BINARY = resolve(ROOT, 'dist/build/profilarr');

/** Vendored fixtures database and its pinned schema (`pnpm fixtures:update`) */
export const FIXTURES_DIR = resolve(ROOT, 'tests/flows/data/fixtures');
export const SCHEMA_DIR = resolve(ROOT, 'tests/flows/data/schema');
export const SOURCE_FILE = resolve(ROOT, 'tests/flows/data/source.json');

/** What the fixtures contain, written by `pnpm fixtures:update` */
export const FIXTURES_SNAPSHOT = resolve(ROOT, 'tests/flows/data/fixtures.json');

/** Fresh Radarr and Sonarr responses for the fake Arrs (`pnpm fixtures:arr`) */
export const ARR_DATA_DIR = resolve(ROOT, 'tests/flows/data/arr');

/**
 * Environment variable holding this run's golden data folder (fixtures seeded
 * and compiled). Global setup creates a fresh temp folder per run and sets it,
 * so parallel runs, like UI mode and the command line, never share one.
 */
export const GOLDEN_DIR_ENV = 'FLOWS_GOLDEN_DIR';

export function goldenDir(): string {
	const dir = process.env[GOLDEN_DIR_ENV];
	if (!dir) throw new Error(`${GOLDEN_DIR_ENV} isn't set; global setup builds it`);
	return dir;
}
