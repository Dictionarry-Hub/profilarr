/**
 * Backup filename validation and path resolution.
 *
 * Protects against path traversal, directory escape, and invalid filenames.
 */

import { join, resolve } from 'node:path';

/** Allowed characters: alphanumeric, hyphens, underscores. */
const VALID_FILENAME_RE = /^backup-[\w-]+\.tar\.gz$/;

/**
 * Check if a filename is a valid backup filename.
 *
 * Must start with "backup-", end with ".tar.gz", and contain only
 * safe characters (no slashes, dots sequences, or null bytes).
 */
export function isValidBackupFilename(filename: string): boolean {
	if (!filename) return false;
	if (filename.includes('\0')) return false;
	if (filename.includes('/')) return false;
	if (filename.includes('\\')) return false;
	if (filename.includes('..')) return false;
	return VALID_FILENAME_RE.test(filename);
}

/**
 * Resolve a backup filename to an absolute path inside the backups directory.
 *
 * Returns the resolved path if valid, or null if the filename is invalid
 * or would resolve outside the backups directory.
 */
export function resolveBackupPath(filename: string, backupsDir: string): string | null {
	if (!isValidBackupFilename(filename)) return null;

	const resolved = resolve(join(backupsDir, filename));
	const normalizedDir = resolve(backupsDir);

	if (!resolved.startsWith(normalizedDir + '/') && resolved !== normalizedDir) {
		return null;
	}

	return resolved;
}

/**
 * Format a byte count into a human-readable size string.
 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
