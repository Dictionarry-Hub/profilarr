import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import deno from '@deno/vite-plugin';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
	plugins: [deno(), tailwindcss(), sveltekit()],
	server: {
		port: 6969,
		host: true,
		watch: {
			usePolling: true,
			interval: 100,
			ignored: [
				'**/data/**',
				'**/logs/**',
				'**/backups/**',
				'**/dist/**',
				'**/*.db*',
				'**/.git/**',
				'**/node_modules/**',
				'**/research/**'
			]
		}
	},
	define: {
		__APP_VERSION__: JSON.stringify(packageJson.version)
	}
});
