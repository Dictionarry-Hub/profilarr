/**
 * Paths the flow suite uses. All relative to the repo root, which is the
 * working directory both on the host and inside the Playwright container.
 */

import { resolve } from 'node:path';

const ROOT = process.cwd();

/** The compiled app, built by `deno task build` */
export const APP_BINARY = resolve(ROOT, 'dist/build/profilarr');

/** Vendored fixtures database and its pinned schema (`deno task fixtures:update`) */
export const FIXTURES_DIR = resolve(ROOT, 'tests/flows/data/fixtures');
export const SCHEMA_DIR = resolve(ROOT, 'tests/flows/data/schema');
export const SOURCE_FILE = resolve(ROOT, 'tests/flows/data/source.json');

/** App data folder with the fixtures seeded and compiled, built once per run */
export const GOLDEN_DIR = resolve(ROOT, 'tests/flows/test-results/.golden');
