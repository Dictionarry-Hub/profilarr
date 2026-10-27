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
 * Deal spec files to `total` shards by run time: the slowest file first, each
 * to the shard with the least time so far, so every shard ends up with about
 * the same time. `timings` holds seconds per file (`harness/timings.json`). A
 * file with no recorded time counts as the average file. With no timings at
 * all every file weighs the same, and the deal goes round like cards.
 */
export function dealSpecFiles(
	files: string[],
	shard: number,
	total: number,
	timings: Record<string, number> = {}
): string[] {
	const known = files.map((file) => timings[file]).filter((time) => time !== undefined);
	const average = known.length ? known.reduce((sum, time) => sum + time, 0) / known.length : 1;
	const weighted = files
		.map((file) => ({ file, time: timings[file] ?? average }))
		.sort((a, b) => b.time - a.time || a.file.localeCompare(b.file));

	const loads = Array.from({ length: total }, () => 0);
	const dealt: string[] = [];
	for (const { file, time } of weighted) {
		// The shard with the least time so far, the lowest number on a tie
		const least = loads.indexOf(Math.min(...loads));
		loads[least] += time;
		if (least === shard - 1) dealt.push(file);
	}
	return dealt.sort();
}
