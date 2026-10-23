/**
 * Change a running app's sessions directly, for states a test can't wait
 * for, such as a confirmation older than the app's 30-minute window.
 */

import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** Move every session's last confirmation `minutes` into the past */
export function ageConfirmations(dataDir: string, minutes: number): void {
	const db = new DatabaseSync(join(dataDir, 'data/profilarr.db'));
	try {
		db.exec('PRAGMA busy_timeout = 5000');
		db.prepare("UPDATE sessions SET confirmed_at = datetime('now', ?)").run(`-${minutes} minutes`);
	} finally {
		db.close();
	}
}
