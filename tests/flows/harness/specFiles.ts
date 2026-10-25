/**
 * The spec files the suite runs, and how `deno task flows --deal` splits them
 * between CI shards.
 *
 * The Playwright config and the deal read the same ignore list, so a folder
 * left out of one is left out of both.
 */

import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Folders under tests/flows that hold no tests, as Playwright globs */
export const TEST_IGNORE = [
	'data/**',
	'test-results*/**',
	'playwright-report/**',
	'blob-report/**',
	'.services/**'
];

/** A glob from TEST_IGNORE as a regex over a path relative to tests/flows */
function globToRegExp(glob: string): RegExp {
	const source = glob
		.split('**')
		.map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))
		.join('.*');
	return new RegExp(`^${source}$`);
}

const IGNORED = TEST_IGNORE.map(globToRegExp);
const isIgnored = (path: string) => IGNORED.some((pattern) => pattern.test(path));

/** Every spec file under `root`, as sorted paths relative to it */
export function listSpecFiles(root: string): string[] {
	const files: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = relative(root, join(dir, entry.name)).split(sep).join('/');
			if (entry.isDirectory()) {
				if (!isIgnored(`${path}/`)) walk(join(dir, entry.name));
			} else if (entry.name.endsWith('.spec.ts') && !isIgnored(path)) {
				files.push(path);
			}
		}
	};
	walk(root);
	return files.sort();
}

/**
 * Deal spec files to `total` shards like cards: the first file to shard 1, the
 * second to shard 2, and so on. Neighbouring files often share an area and its
 * cost, so slow areas spread across the shards instead of filling one.
 */
export function dealSpecFiles(files: string[], shard: number, total: number): string[] {
	return files.filter((_, index) => index % total === shard - 1);
}
