/**
 * Core backup creation logic
 * Separated from job definition to avoid database/config dependencies for testing
 */

import { Database } from '@jsr/db__sqlite';

export interface CreateBackupResult {
	success: boolean;
	filename?: string;
	sizeBytes?: number;
	error?: string;
}

/**
 * SQL statements to strip secrets from a backup database copy.
 * The production database is never modified — these run against a temp copy only.
 */
const SANITIZE_SQL = [
	"UPDATE arr_instances SET api_key = ''",
	'UPDATE database_instances SET personal_access_token = NULL',
	'UPDATE auth_settings SET api_key = NULL',
	"UPDATE ai_settings SET api_key = ''",
	"UPDATE tmdb_settings SET api_key = ''",
	"UPDATE notification_services SET config = '{}'",
	'DELETE FROM users',
	'DELETE FROM sessions',
	'DELETE FROM login_attempts'
];

/**
 * Core backup logic - creates a tar.gz archive of a directory
 * Pure function that only depends on Deno APIs
 *
 * @param sourceDir Directory to backup (will backup this entire directory)
 * @param backupDir Directory where backup file will be saved
 * @param timestamp Optional timestamp for backup filename (defaults to current time)
 * @returns Backup result with filename and size or error
 */
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

		// Copy source to a temp directory and sanitize the DB copy
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

		// Sanitize the database copy (skip if no DB in source)
		const dbPath = `${tmpDataDir}/profilarr.db`;
		try {
			const dbStat = await Deno.stat(dbPath);
			if (dbStat.isFile) {
				const db = new Database(dbPath);
				try {
					for (const sql of SANITIZE_SQL) {
						db.exec(sql); // nosemgrep: profilarr.sql.exec-with-variable — SANITIZE_SQL is a hardcoded constant
					}
				} finally {
					db.close();
				}
			}
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				// No database to sanitize — that's fine
			} else {
				return {
					success: false,
					error: `Failed to sanitize backup database: ${error instanceof Error ? error.message : String(error)}`
				};
			}
		}

		// Create tar.gz archive from the sanitized temp copy
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
