/**
 * Seed the vendored fixtures database into an app's data folder.
 *
 * Call while the app is stopped, after it has created and migrated its own
 * database. The next start imports and compiles the fixtures through the
 * normal startup path, the same as a database linked from GitHub.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FIXTURES_DIR, SCHEMA_DIR, SOURCE_FILE } from '$flows/harness/paths.ts';

export const FIXTURES_NAME = 'Fixtures';
const FIXTURES_UUID = 'fixtures';

function git(args: string[], cwd: string): void {
	const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
	if (result.status !== 0) {
		throw new Error(`git ${args.join(' ')} failed:\n${result.stderr ?? result.error}`);
	}
}

/**
 * Copy the fixtures and their schema into the data folder, commit them to a
 * fresh git repo (pages like Changes run git there), and add the database row.
 */
export async function seedFixtures(dataDir: string): Promise<void> {
	const pcdPath = join(dataDir, 'data/databases', FIXTURES_UUID);
	await fs.cp(FIXTURES_DIR, pcdPath, { recursive: true });
	await fs.cp(SCHEMA_DIR, join(pcdPath, 'deps/schema'), { recursive: true });

	git(['init', '--quiet'], pcdPath);
	git(['add', '--all'], pcdPath);
	git(
		[
			'-c',
			'user.name=flows',
			'-c',
			'user.email=flows@localhost',
			'commit',
			'--quiet',
			'-m',
			'fixtures'
		],
		pcdPath
	);

	const source = JSON.parse(await fs.readFile(SOURCE_FILE, 'utf8'));
	const db = new DatabaseSync(join(dataDir, 'data/profilarr.db'));
	try {
		db.prepare(
			`INSERT INTO database_instances (
				uuid, name, repository_url, local_path,
				sync_strategy, auto_pull, enabled, is_private,
				personal_access_token, local_ops_enabled, conflict_strategy
			) VALUES (?, ?, ?, ?, 0, 0, 1, 0, NULL, 1, 'override')`
		).run(FIXTURES_UUID, FIXTURES_NAME, source.fixtures.repository, pcdPath);
	} finally {
		db.close();
	}
}
