/**
 * Backup sanitization for the download endpoint.
 *
 * Local backup archives are full-fidelity (secrets included) because they sit
 * inside the same filesystem trust boundary as the source database. The moment
 * a backup leaves the host though (download, share, attach to a bug report)
 * the trust boundary ends. To make the download path safe to share, we strip
 * sensitive data on the fly when the file is requested.
 *
 * The strategy is "nuke whole rows" rather than "blank specific fields":
 *
 * - DELETE FROM arr_instances cascades through every arr-side table (sync
 *   configs, drift, rename, cleanup, upgrades, runs). The user loses URLs
 *   (which can be internal hostnames), api keys, and the entire sync graph.
 * - DELETE FROM notification_services cascades to history. Webhook URLs and
 *   service names (which can be revealing) go with them.
 * - users / sessions / login_attempts removed; usernames could be real
 *   emails for OIDC users.
 * - database_instances PATs are nulled but the rows stay (PCD repos remain
 *   linked to the user post-restore).
 * - Git remote URLs in cloned PCD repos are kept, but any embedded HTTP(S)
 *   credentials are removed from `.git/config`. Clones no longer save the
 *   token there (utils/git/auth.ts), so this guards backups from older
 *   versions.
 * - ai_settings / tmdb_settings api keys nulled (rows stay).
 * - api_keys rows deleted. Backups from before migration 072 keep the key
 *   in auth_settings.api_key instead, which is nulled. See `stripApiKeys`.
 *
 * This is more aggressive than a strict per-field strip but it's fail-safe:
 * any new sensitive column added later to arr_instances or
 * notification_services is automatically protected by virtue of the row
 * being deleted.
 */

import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as fs from 'node:fs/promises';
import { Database } from '@db/sqlite';
import { runCommand } from '../command.ts';
import { isNotFound } from '../fs.ts';

/**
 * SQL applied to a backup database copy at download time. Order matters
 * only insofar as cascades fire from the parents.
 */
export const SANITIZE_SQL = [
	'DELETE FROM arr_instances',
	'DELETE FROM notification_services',
	'DELETE FROM users',
	'DELETE FROM sessions',
	'DELETE FROM login_attempts',
	'UPDATE database_instances SET personal_access_token = NULL',
	"UPDATE ai_settings SET api_key = ''",
	"UPDATE tmdb_settings SET api_key = ''"
];

/**
 * Categories of data stripped, surfaced to the UI so the user knows exactly
 * what they're about to share. Kept in sync with `SANITIZE_SQL` above.
 */
export const SANITIZED_CATEGORIES = [
	'Arr instances (URLs, API keys, sync configs, drift state, rename and cleanup history)',
	'Notification services (webhook URLs, tokens, history)',
	'User accounts and active sessions',
	'API keys',
	'Personal access tokens for linked databases',
	'Credentials embedded in cloned database Git remote URLs',
	'AI and TMDB API keys'
];

function sanitizeGitConfigContent(content: string): string {
	return content.replace(/^(\s*url\s*=\s*)(\S+)(.*)$/gm, (match, prefix, rawUrl, suffix) => {
		try {
			const url = new URL(rawUrl);
			if (url.protocol !== 'http:' && url.protocol !== 'https:') return match;
			if (!url.username && !url.password) return match;

			url.username = '';
			url.password = '';
			return `${prefix}${url.toString()}${suffix}`;
		} catch {
			return match;
		}
	});
}

async function sanitizeGitConfigs(rootDir: string): Promise<void> {
	async function walk(dir: string): Promise<void> {
		for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
			const path = `${dir}/${entry.name}`;

			if (entry.isDirectory()) {
				if (entry.name === '.git') {
					const configPath = `${path}/config`;
					try {
						const content = await fs.readFile(configPath, 'utf8');
						const sanitized = sanitizeGitConfigContent(content);
						if (sanitized !== content) {
							await fs.writeFile(configPath, sanitized);
						}
					} catch (err) {
						if (!isNotFound(err)) throw err;
					}
					continue;
				}

				await walk(path);
			}
		}
	}

	try {
		await walk(rootDir);
	} catch (err) {
		if (!isNotFound(err)) throw err;
	}
}

/**
 * Apply the sanitize SQL to an open SQLite database handle.
 * Caller is responsible for opening and closing the handle.
 */
export function applySanitize(db: Database): void {
	// SQLite doesn't erase deleted data by default: removed rows stay in the
	// file's free space and can be read from the raw bytes. secure_delete
	// zeroes them as they're removed, and VACUUM rebuilds the file from live
	// rows only, dropping any free space left over.
	db.exec('PRAGMA secure_delete = ON');
	for (const sql of SANITIZE_SQL) {
		db.exec(sql); // nosemgrep: profilarr.sql.exec-with-variable - SANITIZE_SQL is a hardcoded constant
	}
	stripApiKeys(db);
	db.exec('VACUUM');
}

/**
 * Where API keys live depends on the backup's age: the api_keys table from
 * migration 072 on, the auth_settings.api_key column before it. Checking
 * first keeps older backups downloadable.
 */
function stripApiKeys(db: Database): void {
	const hasTable = db
		.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'api_keys'")
		.get();
	if (hasTable) {
		db.exec('DELETE FROM api_keys');
	}

	const hasLegacyColumn = db
		.prepare("SELECT 1 FROM pragma_table_info('auth_settings') WHERE name = 'api_key'")
		.get();
	if (hasLegacyColumn) {
		db.exec('UPDATE auth_settings SET api_key = NULL');
	}
}

interface ArchiveInfo {
	appVersion?: string;
	appChannel?: string;
	schemaVersion?: number | null;
	createdAt?: string;
	sanitized?: boolean;
}

/**
 * Produce a sanitized copy of a local backup archive. Extracts the archive
 * into a temp directory, runs SANITIZE_SQL against the embedded DB, flips
 * INFO.json's `sanitized` flag to true, re-tars, and returns the bytes.
 *
 * The local archive on disk is not modified.
 */
export async function buildSanitizedArchive(archivePath: string): Promise<Uint8Array> {
	const tmpDir = await fs.mkdtemp(join(tmpdir(), 'profilarr-backup-egress-'));
	try {
		// Extract.
		const extractResult = await runCommand('tar', ['-xzf', archivePath, '-C', tmpDir]);
		if (extractResult.code !== 0) {
			const stderr = new TextDecoder().decode(extractResult.stderr).trim();
			throw new Error(`Failed to extract archive: ${stderr}`);
		}

		const dataDir = `${tmpDir}/data`;
		const dbPath = `${dataDir}/profilarr.db`;

		// Sanitize the DB copy in place.
		const dbExists = await fs.stat(dbPath).then(
			() => true,
			(err) => {
				if (isNotFound(err)) return false;
				throw err;
			}
		);
		if (dbExists) {
			const dest = new Database(dbPath);
			try {
				applySanitize(dest);
				dest.exec('PRAGMA wal_checkpoint(TRUNCATE)');
				dest.exec('PRAGMA journal_mode = DELETE');
			} finally {
				dest.close();
			}
		}

		await sanitizeGitConfigs(`${dataDir}/databases`);

		// Flip INFO.json's sanitized flag.
		const infoPath = `${dataDir}/INFO.json`;
		try {
			const raw = await fs.readFile(infoPath, 'utf8');
			const info = JSON.parse(raw) as ArchiveInfo;
			info.sanitized = true;
			await fs.writeFile(infoPath, JSON.stringify(info, null, 2));
		} catch (err) {
			if (!isNotFound(err)) throw err;
			// Older archives may not have INFO.json. Not fatal.
		}

		// Re-tar the (now sanitized) data dir.
		const archive = `${tmpDir}/sanitized.tar.gz`;
		const tarResult = await runCommand('tar', ['-czf', archive, '-C', tmpDir, 'data']);
		if (tarResult.code !== 0) {
			const stderr = new TextDecoder().decode(tarResult.stderr).trim();
			throw new Error(`Failed to re-archive after sanitize: ${stderr}`);
		}

		return await fs.readFile(archive);
	} finally {
		try {
			await fs.rm(tmpDir, { recursive: true });
		} catch {
			// Best-effort cleanup.
		}
	}
}
