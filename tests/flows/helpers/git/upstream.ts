/**
 * The fixtures database's upstream: a local bare repo that plays its GitHub
 * repo (see harness/seed.ts). Every test's app has its own. The app pulls from
 * it and publishes to it through its normal git commands, offline.
 *
 * A test changes the upstream the way a database developer would: `commit`
 * clones it, writes files, commits and pushes. The app then sees the commit
 * under Updates and as incoming changes on the Changes tab.
 */

import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from '@playwright/test';
import type { App } from '#flows/harness/app.ts';
import { git } from '#flows/harness/git.ts';
import { fixturesRepo as repoIn, upstreamRepo } from '#flows/harness/seed.ts';

export { FLOWS_TOKEN } from '#flows/harness/seed.ts';

const BRANCH = 'main';

/** The app's linked fixtures repo, where it pulls into and commits from */
export function fixturesRepo(app: App): string {
	return repoIn(app.dir);
}

export interface UpstreamCommit {
	hash: string;
	subject: string;
}

export interface Upstream {
	/** The bare repo */
	dir: string;
	/**
	 * Commit files to the upstream and push, as a developer would. Paths are
	 * relative to the repo root; null deletes a file. Returns the commit hash.
	 */
	commit(files: Record<string, string | null>, message: string): Promise<string>;
	/** Commit one op file under ops/. Returns the commit hash. */
	commitOp(filename: string, sql: string, message: string): Promise<string>;
	/** The upstream's commits, newest first */
	log(): UpstreamCommit[];
	/** A file's content in the upstream's latest commit */
	show(path: string): string;
	/** The files in the upstream's latest commit under a folder, e.g. "ops", or "" for the root */
	files(folder: string): string[];
}

/** The app's upstream */
export function upstream(app: App): Upstream {
	const dir = upstreamRepo(app.dir);

	const commit = async (files: Record<string, string | null>, message: string) =>
		await test.step(
			`Commit "${message}" upstream`,
			async () => {
				const scratch = await fs.mkdtemp(join(app.dir, 'upstream-work-'));
				try {
					git(['clone', '--quiet', dir, scratch], app.dir);
					for (const [path, content] of Object.entries(files)) {
						const target = join(scratch, path);
						if (content === null) {
							await fs.rm(target);
						} else {
							await fs.mkdir(dirname(target), { recursive: true });
							await fs.writeFile(target, content);
						}
					}
					git(['add', '--all'], scratch);
					git(['commit', '--quiet', '-m', message], scratch);
					git(['push', '--quiet', 'origin', `HEAD:${BRANCH}`], scratch);
					return git(['rev-parse', 'HEAD'], scratch);
				} finally {
					await fs.rm(scratch, { recursive: true, force: true });
				}
			},
			{ box: true }
		);

	return {
		dir,
		commit,
		commitOp: (filename, sql, message) => commit({ [`ops/${filename}`]: sql }, message),
		log: () =>
			git(['log', '--format=%H%x09%s', BRANCH], dir)
				.split('\n')
				.filter(Boolean)
				.map((line) => {
					const [hash, subject] = line.split('\t');
					return { hash, subject };
				}),
		show: (path) => git(['show', `${BRANCH}:${path}`], dir),
		files: (folder) =>
			git(['ls-tree', '--name-only', `${BRANCH}:${folder}`], dir)
				.split('\n')
				.filter(Boolean)
	};
}
