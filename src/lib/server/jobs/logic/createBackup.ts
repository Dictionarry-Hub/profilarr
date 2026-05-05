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

import { Database } from '@jsr/db__sqlite';
import { db } from '$db/db.ts';

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
			await Deno.mkdir(backupDir, { recursive: true });
		} catch (error) {
			return {
				success: false,
				error: `Failed to create backup directory: ${error instanceof Error ? error.message : String(error)}`
			};
		}

		// Verify source directory exists
		try {
			const stat = await Deno.stat(sourceDir);
			if (!stat.isDirectory) {
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
		tmpDir = await Deno.makeTempDir({ prefix: 'profilarr-backup-' });
		const tmpDataDir = `${tmpDir}/data`;

		const cp = new Deno.Command('cp', {
			args: ['-a', sourceDir, tmpDataDir],
			stdout: 'piped',
			stderr: 'piped'
		});
		const cpResult = await cp.output();
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
			const dbStat = await Deno.stat(dbPath);
			if (dbStat.isFile) {
				await Deno.remove(dbPath);
				for (const sidecar of [walPath, shmPath]) {
					try {
						await Deno.remove(sidecar);
					} catch (err) {
						if (!(err instanceof Deno.errors.NotFound)) throw err;
					}
				}

				const dest = new Database(dbPath);
				try {
					db.getDatabase().backup(dest);
					dest.exec('PRAGMA wal_checkpoint(TRUNCATE)');
					dest.exec('PRAGMA journal_mode = DELETE');
				} finally {
					dest.close();
				}
			}
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				// No database in source; nothing to snapshot.
			} else {
				return {
					success: false,
					error: `Failed to snapshot backup database: ${error instanceof Error ? error.message : String(error)}`
				};
			}
		}

		// Create tar.gz archive from the temp copy
		const command = new Deno.Command('tar', {
			args: ['-czf', backupPath, '-C', tmpDir, 'data'],
			stdout: 'piped',
			stderr: 'piped'
		});

		const { code, stderr } = await command.output();

		if (code !== 0) {
			const errorMessage = new TextDecoder().decode(stderr);
			return {
				success: false,
				error: `tar command failed with code ${code}: ${errorMessage}`
			};
		}

		// Get backup file size
		const stat = await Deno.stat(backupPath);

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
				await Deno.remove(tmpDir, { recursive: true });
			} catch {
				// Best-effort cleanup
			}
		}
	}
}
