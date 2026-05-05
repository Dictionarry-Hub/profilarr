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
 * - ai_settings / tmdb_settings api keys nulled (rows stay).
 * - auth_settings.api_key NOT touched; it's bcrypt-hashed of a high-entropy
 *   random key, so the hash is computationally infeasible to brute-force.
 *
 * This is more aggressive than a strict per-field strip but it's fail-safe:
 * any new sensitive column added later to arr_instances or
 * notification_services is automatically protected by virtue of the row
 * being deleted.
 */

import { Database } from '@jsr/db__sqlite';

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
	'Personal access tokens for linked databases',
	'AI and TMDB API keys'
];

/**
 * Apply the sanitize SQL to an open SQLite database handle.
 * Caller is responsible for opening and closing the handle.
 */
export function applySanitize(db: Database): void {
	for (const sql of SANITIZE_SQL) {
		db.exec(sql); // nosemgrep: profilarr.sql.exec-with-variable - SANITIZE_SQL is a hardcoded constant
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
	const tmpDir = await Deno.makeTempDir({ prefix: 'profilarr-backup-egress-' });
	try {
		// Extract.
		const extract = new Deno.Command('tar', {
			args: ['-xzf', archivePath, '-C', tmpDir],
			stdout: 'piped',
			stderr: 'piped'
		});
		const extractResult = await extract.output();
		if (extractResult.code !== 0) {
			const stderr = new TextDecoder().decode(extractResult.stderr).trim();
			throw new Error(`Failed to extract archive: ${stderr}`);
		}

		const dataDir = `${tmpDir}/data`;
		const dbPath = `${dataDir}/profilarr.db`;

		// Sanitize the DB copy in place.
		const dbExists = await Deno.stat(dbPath).then(
			() => true,
			(err) => {
				if (err instanceof Deno.errors.NotFound) return false;
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

		// Flip INFO.json's sanitized flag.
		const infoPath = `${dataDir}/INFO.json`;
		try {
			const raw = await Deno.readTextFile(infoPath);
			const info = JSON.parse(raw) as ArchiveInfo;
			info.sanitized = true;
			await Deno.writeTextFile(infoPath, JSON.stringify(info, null, 2));
		} catch (err) {
			if (!(err instanceof Deno.errors.NotFound)) throw err;
			// Older archives may not have INFO.json. Not fatal.
		}

		// Re-tar the (now sanitized) data dir.
		const archive = `${tmpDir}/sanitized.tar.gz`;
		const tar = new Deno.Command('tar', {
			args: ['-czf', archive, '-C', tmpDir, 'data'],
			stdout: 'piped',
			stderr: 'piped'
		});
		const tarResult = await tar.output();
		if (tarResult.code !== 0) {
			const stderr = new TextDecoder().decode(tarResult.stderr).trim();
			throw new Error(`Failed to re-archive after sanitize: ${stderr}`);
		}

		return await Deno.readFile(archive);
	} finally {
		try {
			await Deno.remove(tmpDir, { recursive: true });
		} catch {
			// Best-effort cleanup.
		}
	}
}
