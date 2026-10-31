/**
 * Vitest config for the unit suite (tests/unit). Kept apart from vite.config.ts
 * so tests don't load the SvelteKit and Tailwind plugins.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/unit/**/*.test.ts'],
		environment: 'node',
		env: { APP_BASE_PATH: './dist/test' }
	}
});
