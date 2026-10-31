import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// The production image ships no node_modules, so the server build inlines every
// package listed under `dependencies`. adapter-node leaves a dependency external
// unless `ssr.noExternal` names it in an array; `noExternal: true` names none.
// The packages stay under `dependencies` so the image SBOM lists them.
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
	dependencies?: Record<string, string>;
};
const RUNTIME_DEPENDENCIES = Object.keys(pkg.dependencies ?? {});

// In dev the server loads packages from node_modules. Only @lucide/svelte, which
// ships raw .svelte files, is compiled into the SSR bundle.
const DEV_NO_EXTERNAL = ['@lucide/svelte'];

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

export default defineConfig(({ command }) => ({
	plugins: [
		tailwindcss(),
		sveltekit({
			preprocess: vitePreprocess({ script: true }),
			adapter: adapter({ out: 'dist/build' })
		})
	],
	ssr: { noExternal: command === 'build' ? RUNTIME_DEPENDENCIES : DEV_NO_EXTERNAL },
	server: {
		port: 6969,
		host: true,
		watch: {
			ignored: [isUnwatched]
		}
	}
}));
