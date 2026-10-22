import { defineConfig } from '@playwright/test';

const workersOverride = process.env.FLOWS_WORKERS;
// Playwright empties the results folder at the start of every run, so UI mode
// gets its own and command-line runs can't wipe the traces it shows.
const outputDir = process.env.FLOWS_UI ? 'test-results-ui' : 'test-results';

export default defineConfig({
	// Resolves the $flows/ import alias.
	tsconfig: './tsconfig.json',

	// Every *.spec.ts under scenarios/ is a test file. Folders group the output.
	testDir: './scenarios',

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

	reporter: [['./reporter.ts'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
	outputDir,

	use: {
		headless: true,
		// Keep a step-by-step trace and a screenshot only when a test fails.
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		viewport: { width: 1440, height: 900 }
		// baseURL comes from each test's own app (helpers/fixtures.ts).
	}
});
