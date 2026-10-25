/**
 * Read and plant settings state a page can't show, such as the stored TMDB
 * token, which never reaches the browser, or a log file from a day long gone.
 */

import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** The stored TMDB token, read from the app database without writing to it */
export function storedTmdbToken(dataDir: string): string {
	const db = new DatabaseSync(join(dataDir, 'data/profilarr.db'), { readOnly: true });
	try {
		db.exec('PRAGMA busy_timeout = 5000');
		const row = db.prepare('SELECT api_key FROM tmdb_settings WHERE id = 1').get() as
			{ api_key: string | null } | undefined;
		return row?.api_key ?? '';
	} finally {
		db.close();
	}
}

/**
 * Write an empty log file into the app's logs folder and return its path. A
 * daily file, named YYYY-MM-DD.log, also gets that day as its modification
 * time, so it doesn't count as the newest log.
 */
export async function plantLogFile(dataDir: string, name: string): Promise<string> {
	const path = join(dataDir, 'logs', name);
	await fs.writeFile(path, '');
	const day = name.match(/^(\d{4}-\d{2}-\d{2})\.log$/)?.[1];
	if (day) {
		const then = new Date(`${day}T12:00:00Z`);
		await fs.utimes(path, then, then);
	}
	return path;
}
