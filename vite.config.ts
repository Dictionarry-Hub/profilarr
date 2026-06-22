import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import deno from '@deno/vite-plugin';

export default defineConfig({
	plugins: [deno(), tailwindcss(), sveltekit()],
	ssr: {
		// Compile @lucide/svelte (ships raw .svelte icons) into the SSR bundle so
		// the deno-compile adapter's esbuild step never sees uncompiled .svelte.
		noExternal: ['@lucide/svelte']
	},
	server: {
		port: 6969,
		host: true,
		watch: {
			usePolling: true,
			interval: 100,
			ignored: [
				'**/data/**',
				'.arr/**',
				'**/data/backups/**',
				'**/dist/**',
				'**/.svelte-kit/**',
				'**/*.db*',
				'**/.git/**',
				'**/node_modules/**',
				'**/research/**'
			]
		}
	}
});
