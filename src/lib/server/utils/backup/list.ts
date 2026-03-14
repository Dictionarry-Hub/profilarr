/**
 * Shared backup listing logic.
 *
 * Used by both the API endpoint and the settings page load function.
 */

import { formatFileSize } from './validation.ts';

export interface BackupFile {
	filename: string;
	created: string;
	size: number;
	sizeFormatted: string;
}

/**
 * List all backup files in the given directory.
 *
 * Scans for files matching `backup-*.tar.gz`, stats each for size and mtime,
 * and returns them sorted newest first.
 */
export async function listBackups(backupsDir: string): Promise<BackupFile[]> {
	const backups: BackupFile[] = [];

	try {
		for await (const entry of Deno.readDir(backupsDir)) {
			if (!entry.isFile) continue;
			if (!entry.name.startsWith('backup-') || !entry.name.endsWith('.tar.gz')) continue;

			const filePath = `${backupsDir}/${entry.name}`;
			const stat = await Deno.stat(filePath);
			const mtime = stat.mtime || new Date();

			backups.push({
				filename: entry.name,
				created: mtime.toISOString(),
				size: stat.size,
				sizeFormatted: formatFileSize(stat.size)
			});
		}
	} catch {
		// Directory may not exist or be empty
	}

	backups.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
	return backups;
}
