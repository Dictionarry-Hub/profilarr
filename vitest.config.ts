/**
 * Vitest config for the unit suite (tests/unit). Kept apart from vite.config.ts
 * so tests don't load the SvelteKit, Deno and Tailwind plugins.
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
		include: ['tests/unit/**/*.test.ts'],
		environment: 'node',
		env: { APP_BASE_PATH: './dist/test' }
	}
});
