/**
 * Vitest config for the unit suite (tests/unit). Kept apart from vite.config.ts
 * so tests don't load the SvelteKit, Deno and Tailwind plugins.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Mirrors the `$` aliases in deno.jsonc until #963 moves them to `#` imports
const aliases: Record<string, string> = {
	$api: 'src/lib/api',
	$config: 'src/lib/server/utils/config/config.ts',
	$logger: 'src/lib/server/utils/logger',
	$shared: 'src/lib/shared',
	$stores: 'src/lib/client/stores',
	$ui: 'src/lib/client/ui',
	$assets: 'src/lib/client/assets',
	$alerts: 'src/lib/client/alerts',
	$db: 'src/lib/server/db',
	$jobs: 'src/lib/server/jobs',
	$drift: 'src/lib/server/drift',
	$pcd: 'src/lib/server/pcd',
	$arr: 'src/lib/server/utils/arr',
	$http: 'src/lib/server/utils/http',
	$utils: 'src/lib/server/utils',
	$notifications: 'src/lib/server/notifications',
	$announcements: 'src/lib/server/announcements',
	$sync: 'src/lib/server/sync',
	$cache: 'src/lib/server/utils/cache',
	$auth: 'src/lib/server/utils/auth',
	'$test-harness': 'tests/harness',
	$flows: 'tests/flows'
};

const root = (path: string) => fileURLToPath(new URL(`./${path}`, import.meta.url));

export default defineConfig({
	resolve: {
		alias: [
			// `$db/x.ts` -> src/lib/server/db/x.ts, `$config` -> config.ts
			...Object.entries(aliases).map(([name, target]) => ({
				find: new RegExp(`^\\${name}(?=/|$)`),
				replacement: root(target)
			})),
			// Deno installs the JSR package under its npm name only
			{ find: /^@std\/assert$/, replacement: '@jsr/std__assert' }
		]
	},
	test: {
		include: ['tests/unit/**/*.test.ts'],
		// Tests of Deno scripts stay on `deno test` until the scripts move off Deno
		exclude: ['tests/unit/pr/**', 'tests/unit/release/**'],
		environment: 'node',
		env: { APP_BASE_PATH: './dist/test' }
	}
});
