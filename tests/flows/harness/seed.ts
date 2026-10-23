/**
 * Seed the vendored fixtures database into an app's data folder.
 *
 * Call while the app is stopped, after it has created and migrated its own
 * database. The next start imports and compiles the fixtures through the
 * normal startup path, the same as a database linked from GitHub.
 *
 * The data folder also gets a local upstream, so pulling and publishing work
 * offline:
 *
 *   gitconfig                 rewrites the fixtures GitHub URL to upstream/
 *   upstream/fixtures.git     plays GitHub: a bare repo, history only
 *   data/databases/fixtures   the linked database, a clone whose origin is
 *                             the GitHub URL
 *
 * The app reads `gitconfig` through GIT_CONFIG_GLOBAL (harness/app.ts), so
 * every git command it runs on the GitHub URL reaches the local upstream.
 */

import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { git, gitConfigPath } from '$flows/harness/git.ts';
import { FIXTURES_DIR, SCHEMA_DIR, SOURCE_FILE } from '$flows/harness/paths.ts';

export const FIXTURES_NAME = 'Fixtures';
const FIXTURES_UUID = 'fixtures';
const BRANCH = 'main';

/**
 * The personal access token tests save to publish. The app puts a token into
 * the GitHub URL it pushes to, and only this token's URL is rewritten to the
 * local upstream. Any other token sends the push to the real GitHub, which
 * fails offline.
 */
export const FLOWS_TOKEN = 'flows-token';

/** The linked fixtures repo in a data folder */
export function fixturesRepo(dataDir: string): string {
	return join(dataDir, 'data/databases', FIXTURES_UUID);
}

/** The bare repo that plays the fixtures database's GitHub repo */
export function upstreamRepo(dataDir: string): string {
	return join(dataDir, 'upstream/fixtures.git');
}

async function fixturesUrl(): Promise<string> {
	const source = JSON.parse(await fs.readFile(SOURCE_FILE, 'utf8'));
	return source.fixtures.repository;
}

/**
 * Write a data folder's gitconfig, pointing the fixtures GitHub URL at
 * `upstream`: the folder's own upstream unless another is given.
 */
export async function writeGitConfig(
	dataDir: string,
	upstream = upstreamRepo(dataDir)
): Promise<void> {
	const url = await fixturesUrl();
	// The same rewrite the app does when it pushes with a token
	const withToken = url.replace('https://github.com', `https://${FLOWS_TOKEN}@github.com`);
	await fs.writeFile(
		gitConfigPath(dataDir),
		`[url "${upstream}"]\n\tinsteadOf = ${url}\n\tinsteadOf = ${withToken}\n`
	);
}

/**
 * Copy the fixtures and their schema into the data folder, commit them, set up
 * the local upstream, add the database row, and turn off the post-save sync
 * prompt.
 */
export async function seedFixtures(dataDir: string): Promise<void> {
	const pcdPath = fixturesRepo(dataDir);
	await fs.cp(FIXTURES_DIR, pcdPath, { recursive: true });
	await fs.cp(SCHEMA_DIR, join(pcdPath, 'deps/schema'), { recursive: true });
	await writeGitConfig(dataDir);

	git(['init', '--quiet', `--initial-branch=${BRANCH}`], pcdPath, dataDir);
	git(['add', '--all'], pcdPath, dataDir);
	git(['commit', '--quiet', '-m', 'fixtures'], pcdPath, dataDir);

	// The upstream starts with the same commit, and the linked repo tracks it
	// through the GitHub URL, like a fresh clone
	const upstream = upstreamRepo(dataDir);
	await fs.mkdir(dirname(upstream), { recursive: true });
	git(['clone', '--quiet', '--bare', pcdPath, upstream], dataDir, dataDir);
	const url = await fixturesUrl();
	git(['remote', 'add', 'origin', url], pcdPath, dataDir);
	git(['fetch', '--quiet', 'origin'], pcdPath, dataDir);
	git(['branch', '--quiet', `--set-upstream-to=origin/${BRANCH}`], pcdPath, dataDir);

	const db = new DatabaseSync(join(dataDir, 'data/profilarr.db'));
	try {
		db.prepare(
			`INSERT INTO database_instances (
				uuid, name, repository_url, local_path,
				sync_strategy, auto_pull, enabled, is_private,
				personal_access_token, local_ops_enabled, conflict_strategy
			) VALUES (?, ?, ?, ?, 0, 0, 1, 0, NULL, 0, 'override')`
		).run(FIXTURES_UUID, FIXTURES_NAME, url, pcdPath);
		// No "sync now?" dialog after saves; tests that need it turn it back on
		db.exec('UPDATE general_settings SET sync_prompt_enabled = 0');
	} finally {
		db.close();
	}
}

/**
 * Point a copied data folder at its own repos. The database rows store
 * absolute paths, so a copy of the golden folder still points at the golden
 * repos until this runs; the app does the same after a restore. The gitconfig
 * is rewritten too, to the copy's own upstream or to `upstream` when given.
 */
export async function relinkDatabases(dataDir: string, upstream?: string): Promise<void> {
	const databasesDir = join(dataDir, 'data/databases');
	const db = new DatabaseSync(join(dataDir, 'data/profilarr.db'));
	try {
		db.prepare(`UPDATE database_instances SET local_path = ? || '/' || uuid`).run(databasesDir);
	} finally {
		db.close();
	}
	await writeGitConfig(dataDir, upstream);
}
