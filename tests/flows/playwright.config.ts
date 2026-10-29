import { defineConfig } from '@playwright/test';
import { TEST_IGNORE } from './harness/specFiles.ts';
import { SCREENS } from './helpers/core/screen.ts';

const workersOverride = process.env.FLOWS_WORKERS;
// Playwright empties the results folder at the start of every run, so UI mode
// gets its own and command-line runs can't wipe the traces it shows.
const outputDir = process.env.FLOWS_UI ? 'test-results-ui' : 'test-results';

export default defineConfig({
	// Every *.spec.ts is a test file: scenarios under scenarios/, and each
	// helper's own spec next to it under helpers/. Folders group the output.
	testDir: '.',
	// Shared with `deno task flows --deal`, which lists spec files the same way
	testIgnore: TEST_IGNORE,

	// Builds the seeded "golden" data folder once, before any test runs.
	globalSetup: './global-setup.ts',

	// Each test gets its own app, so tests in the same file can run in parallel too.
	fullyParallel: true,

	// How many tests run at once. Capped on CI so GitHub runners aren't overloaded.
	workers: workersOverride ? Number(workersOverride) : process.env.CI ? 4 : '50%',

	// Per test, including its app starting. expect() retries for up to 10s.
	timeout: 60_000,
	expect: { timeout: 10_000 },

	// No retries: flaky tests should show up, not hide.
	retries: 0,

	// Fail CI if a test.only() is left in.
	forbidOnly: !!process.env.CI,

	reporter: [
		['./reporter.ts'],
		['html', { open: 'never', outputFolder: 'playwright-report' }],
		// Each CI shard saves a blob report. The Flow Tests job merges them into one.
		...(process.env.CI ? [['blob', { outputDir: 'blob-report' }] as const] : [])
	],
	outputDir,

	use: {
		headless: true,
		// Keep a step-by-step trace and a screenshot only when a test fails.
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		viewport: SCREENS.desktop,
		// A trace's film strip is made of small screencast frames. With
		// FLOWS_VIDEO set, each test also records a full-size video, which the
		// trace viewer plays instead. Recording slows runs, so it's opt-in.
		video: process.env.FLOWS_VIDEO ? { mode: 'on', size: SCREENS.desktop } : 'off'
		// baseURL comes from each test's own app (helpers/core/test.ts).
	}
});
