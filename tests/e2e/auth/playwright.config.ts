import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: '.',
	timeout: 60_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	retries: 0,
	workers: 1,
	reporter: 'list',
	use: {
		headless: process.env.HEADED !== '1',
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
		ignoreHTTPSErrors: true
	}
});
