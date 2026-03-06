/**
 * Reset the test repo to a known state between tests.
 * Records the HEAD before a test and force-pushes back to it after.
 */
import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import { DB_PATH } from '../env';

interface DatabaseRow {
	uuid: string;
	local_path: string;
}

/**
 * Get the local clone path for a database by its ID.
 */
function getClonePath(databaseId: number): string {
	const db = new Database(DB_PATH, { readonly: true });
	try {
		const row = db
			.prepare('SELECT uuid, local_path FROM database_instances WHERE id = ?')
			.get(databaseId) as DatabaseRow | undefined;
		if (!row) throw new Error(`Database ${databaseId} not found`);
		return row.local_path;
	} finally {
		db.close();
	}
}

/**
 * Get the current HEAD commit hash for a database's local clone.
 */
export function getHead(databaseId: number): string {
	const clonePath = getClonePath(databaseId);
	return execSync('git rev-parse HEAD', { cwd: clonePath, encoding: 'utf-8' }).trim();
}

/**
 * Reset the repo back to a specific commit.
 * Set push=true for databases with write access (PAT) to also force-push.
 * Local (no-PAT) databases should use push=false to avoid credential prompts.
 */
export function resetToCommit(databaseId: number, commitHash: string, push = false): void {
	const clonePath = getClonePath(databaseId);
	execSync(`git reset --hard ${commitHash}`, { cwd: clonePath, encoding: 'utf-8' });
	if (push) {
		execSync('git push --force', { cwd: clonePath, encoding: 'utf-8' });
	}
}
