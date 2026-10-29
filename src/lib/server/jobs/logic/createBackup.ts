/**
 * Core backup creation logic.
 *
 * Local backups are full-fidelity: secrets are kept in the on-disk archive
 * because it sits inside the same filesystem trust boundary as the source DB.
 * Sanitization happens at egress (download endpoint), not at creation.
 *
 * The SQLite app database is copied via the online backup API rather than a
 * raw filesystem `cp`, so the archive contains a single consistent `.db`
 * with no `-wal`/`-shm` sidecars. Other contents of the source directory
 * (notably `databases/` for cloned PCD repos) are copied as-is.
 */

import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as fs from 'node:fs/promises';
import { Database } from '#db/sqlite.ts';
import { db } from '#db/db.ts';
import { migrationRunner } from '#db/migrations.ts';
import { logger } from '#logger/logger.ts';
import { runCommand } from '#utils/command.ts';
import { build } from '#shared/build.ts';
import { isNotFound } from '#utils/fs.ts';

export interface CreateBackupResult {
	success: boolean;
	filename?: string;
	sizeBytes?: number;
	error?: string;
}

export async function createBackup(
	sourceDir: string,
	backupDir: string,
	timestamp?: Date
): Promise<CreateBackupResult> {
	let tmpDir: string | null = null;

	try {
		// Generate backup filename with timestamp
		const now = timestamp ?? new Date();
		const datePart = now.toISOString().split('T')[0]; // YYYY-MM-DD
		const timePart = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, ''); // HHMMSS
		const backupFilename = `backup-${datePart}-${timePart}.tar.gz`;
		const backupPath = `${backupDir}/${backupFilename}`;

		// Ensure backup directory exists
		try {
			await fs.mkdir(backupDir, { recursive: true });
		} catch (error) {
			return {
				success: false,
				error: `Failed to create backup directory: ${error instanceof Error ? error.message : String(error)}`
			};
		}

		// Verify source directory exists
		try {
			const stat = await fs.stat(sourceDir);
			if (!stat.isDirectory()) {
				return {
					success: false,
					error: `Source path is not a directory: ${sourceDir}`
				};
			}
		} catch (_error) {
			return {
				success: false,
				error: `Source directory does not exist: ${sourceDir}`
			};
		}

		// Copy source to a temp directory; the DB inside it gets replaced
		// with a clean snapshot below.
		tmpDir = await fs.mkdtemp(join(tmpdir(), 'profilarr-backup-'));
		const tmpDataDir = `${tmpDir}/data`;

		const cpResult = await runCommand('cp', ['-a', sourceDir, tmpDataDir]);
		if (cpResult.code !== 0) {
			const errorMessage = new TextDecoder().decode(cpResult.stderr);
			return {
				success: false,
				error: `Failed to copy source directory: ${errorMessage}`
			};
		}

		// Replace the raw-copied DB (and its sidecars) with a consistent
		// snapshot via SQLite's online backup API. The cp above may have
		// captured a mid-write `-wal`/`-shm`; a snapshot of committed state
		// is the only safe way to copy a live WAL database. Skipped when
		// the source has no `profilarr.db` (unit tests with fake source dirs).
		const dbPath = `${tmpDataDir}/profilarr.db`;
		const walPath = `${tmpDataDir}/profilarr.db-wal`;
		const shmPath = `${tmpDataDir}/profilarr.db-shm`;
		try {
			const dbStat = await fs.stat(dbPath);
			if (dbStat.isFile()) {
				await fs.rm(dbPath);
				for (const sidecar of [walPath, shmPath]) {
					try {
						await fs.rm(sidecar);
					} catch (err) {
						if (!isNotFound(err)) throw err;
					}
				}

				await db.getDatabase().backupTo(dbPath);
				const dest = new Database(dbPath);
				try {
					dest.exec('PRAGMA wal_checkpoint(TRUNCATE)');
					dest.exec('PRAGMA journal_mode = DELETE');

					// Verify the snapshot. The backup API copies pages as-is,
					// so a corrupt source produces a corrupt archive. Surfacing
					// it here saves diagnosing mystery errors after restore.
					const rows = dest.prepare('PRAGMA integrity_check').all() as Array<{
						integrity_check: string;
					}>;
					const ok = rows.length === 1 && rows[0].integrity_check === 'ok';
					if (!ok) {
						await logger.warn('Backup source has integrity issues; archive contains them as-is', {
							source: 'createBackup',
							meta: { issues: rows.map((r) => r.integrity_check).slice(0, 10) }
						});
					}
				} finally {
					dest.close();
				}

				// Write INFO.json metadata. Read by the boot-time apply step
				// for diagnostics and by the download endpoint for sanitized
				// flag handling. Schema version comes from the `migrations`
				// table (Profilarr's tracking mechanism), not PRAGMA user_version.
				const info = {
					appVersion: build.version,
					appChannel: build.channel,
					schemaVersion: migrationRunner.getCurrentVersion(),
					createdAt: now.toISOString(),
					sanitized: false
				};
				await fs.writeFile(`${tmpDataDir}/INFO.json`, JSON.stringify(info, null, 2));
			}
		} catch (error) {
			if (isNotFound(error)) {
				// No database in source; nothing to snapshot.
			} else {
				return {
					success: false,
					error: `Failed to snapshot backup database: ${error instanceof Error ? error.message : String(error)}`
				};
			}
		}

		// Create tar.gz archive from the temp copy
		const { code, stderr } = await runCommand('tar', ['-czf', backupPath, '-C', tmpDir, 'data']);

		if (code !== 0) {
			const errorMessage = new TextDecoder().decode(stderr);
			return {
				success: false,
				error: `tar command failed with code ${code}: ${errorMessage}`
			};
		}

		// Get backup file size
		const stat = await fs.stat(backupPath);

		return {
			success: true,
			filename: backupFilename,
			sizeBytes: stat.size
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error)
		};
	} finally {
		// Clean up temp directory
		if (tmpDir) {
			try {
				await fs.rm(tmpDir, { recursive: true });
			} catch {
				// Best-effort cleanup
			}
		}
	}
}
