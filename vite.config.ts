import adapter from './src/adapter/index.js';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
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
		tailwindcss(),
		sveltekit({
			preprocess: vitePreprocess({ script: true }),
			adapter: adapter({
				usage: 'deno-compile',
				out: 'dist/build',
				buildOptions: { logOverride: { 'ignored-bare-import': 'silent' } }
			})
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
