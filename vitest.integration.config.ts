/**
 * Vitest config for the integration suite (tests/integration). Each spec file
 * runs in its own forked process and starts its own profilarr server, so
 * workers are capped at 10 to keep parallel server boots within the memory of
 * CI runners. globalSetup starts the auth Docker stack and cleans up server
 * directories; the setup file dumps server output when a spec fails.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: [
			// Deno installs the JSR package under its npm name only
			{ find: /^@std\/assert$/, replacement: '@jsr/std__assert' }
		]
	},
	test: {
		include: ['tests/integration/specs/**/*.test.ts'],
		environment: 'node',
		pool: 'forks',
		maxWorkers: 10,
		// Server start alone can wait up to 60s for the health check
		testTimeout: 120_000,
		hookTimeout: 120_000,
		env: { INTEGRATION_TEST: '1' },
		globalSetup: ['tests/integration/harness/globalSetup.ts'],
		setupFiles: ['tests/integration/harness/vitest.setup.ts'],
		// Run after hooks in registration order so the setup file's afterAll
		// sees the spec's servers before the spec's afterAll stops them
		sequence: { hooks: 'list' }
	}
});
