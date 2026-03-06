import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './specs',
	timeout: 60_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	retries: 0,
	workers: 1,
	reporter: 'list',
	use: {
		baseURL: process.env.BASE_URL || 'http://localhost:6969',
		headless: process.env.HEADED !== '1',
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure'
	}
});
