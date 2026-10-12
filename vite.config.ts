import adapter from './src/adapter/index.js';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import deno from '@deno/vite-plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// The dev watcher only needs app sources. Everything else in the repo (runtime
// data in config/ and dist/, tests, docs, the C# parser) is skipped so it never
// triggers reloads. Files directly in the root (vite.config.ts, .env, ...) are
// still watched. SvelteKit separately ignores .svelte-kit/ except generated/.
const WATCHED_DIRS = new Set(['src', 'static', '.svelte-kit']);

function isUnwatched(file: string): boolean {
	const [top, ...rest] = path.relative(root, file).split(path.sep);
	if (top === '' || top === '..' || rest.length === 0) return false;
	if (top === 'src' && rest[0] === 'services') return true;
	return !WATCHED_DIRS.has(top);
}

export default defineConfig({
	plugins: [
		deno(),
		tailwindcss(),
		sveltekit({
			preprocess: vitePreprocess({ script: true }),
			adapter: adapter({
				usage: 'deno-compile',
				out: 'dist/build',
				buildOptions: { logOverride: { 'ignored-bare-import': 'silent' } }
			}),

			alias: {
				$api: './src/lib/api',
				$config: './src/lib/server/utils/config/config.ts',
				$logger: './src/lib/server/utils/logger',
				$shared: './src/lib/shared',
				$stores: './src/lib/client/stores',
				$ui: './src/lib/client/ui',
				$assets: './src/lib/client/assets',
				$alerts: './src/lib/client/alerts',
				$server: './src/server',
				$db: './src/lib/server/db',
				$jobs: './src/lib/server/jobs',
				$drift: './src/lib/server/drift',
				$pcd: './src/lib/server/pcd',
				$arr: './src/lib/server/utils/arr',
				$http: './src/lib/server/utils/http',
				$utils: './src/lib/server/utils',
				$notifications: './src/lib/server/notifications',
				$announcements: './src/lib/server/announcements',
				$cache: './src/lib/server/utils/cache',
				$sync: './src/lib/server/sync',
				$auth: './src/lib/server/utils/auth',
				$cutscene: './src/lib/client/cutscene'
			}
		})
	],
	ssr: {
		// Compile @lucide/svelte (ships raw .svelte icons) into the SSR bundle so
		// the deno-compile adapter's esbuild step never sees uncompiled .svelte.
		noExternal: ['@lucide/svelte']
	},
	server: {
		port: 6969,
		host: true,
		watch: {
			ignored: [isUnwatched]
		}
	}
});
