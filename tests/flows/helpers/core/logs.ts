/**
 * Read what the app logged, from the data Settings › Logs loads: the newest
 * log file's entries. A scenario checks a log line when the app reports a
 * result only there, such as which profiles a cleanup skipped.
 */

import { test, type Page } from '@playwright/test';
import { pageData } from './pageData.ts';

/** One line of the app's log */
export interface LogEntry {
	timestamp: string;
	level: string;
	message: string;
	source?: string;
	meta?: unknown;
}

export interface LogFilter {
	/** The logger source, e.g. "Cleanup" */
	source?: string;
	/** The exact message, e.g. "Cleanup complete" */
	message?: string;
}

/** The log entries Settings › Logs shows, only those matching `filter` */
export async function logEntries(page: Page, filter: LogFilter = {}): Promise<LogEntry[]> {
	return await test.step(
		`Read log entries${filter.message ? ` "${filter.message}"` : ''}`,
		async () => {
			const { logs } = await pageData<{ logs: LogEntry[] }>(page, '/settings/logs');
			return logs.filter(
				(entry) =>
					(filter.source === undefined || entry.source === filter.source) &&
					(filter.message === undefined || entry.message === filter.message)
			);
		},
		{ box: true }
	);
}
