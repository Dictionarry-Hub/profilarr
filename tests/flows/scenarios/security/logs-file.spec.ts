/**
 * - Threat: the Logs page reads the file its `?file=` parameter names, from
 *   the logs folder. A path such as `../data/profilarr.db` would read a file
 *   outside it, such as the app database with its secrets, and send its
 *   lines to the page.
 * - Defence: the Logs page load only opens a file the logs list holds
 *   (src/routes/settings/logs/+page.server.ts). Anything else reads nothing,
 *   shows the newest log, warns the user, and logs a WARN line naming the
 *   requested file.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '#flows/helpers/core/test.ts';
import { logEntries, type LogEntry } from '#flows/helpers/core/logs.ts';
import { openPage } from '#flows/helpers/core/nav.ts';
import { pageData } from '#flows/helpers/core/pageData.ts';
import type { LogFile } from '#flows/helpers/settings/logs.ts';

const REQUESTED = '../data/profilarr.db';
const LOGS_URL = `/settings/logs?file=${encodeURIComponent(REQUESTED)}`;
/** The first bytes of every SQLite database */
const SQLITE_HEADER = 'SQLite format 3';
/** The warnings the page picks from (src/routes/settings/logs/+page.svelte) */
const WARNINGS = [
	"Nice try. That's not a log file, so here's the latest log instead.",
	"That file isn't a log. Logs are all this page will show you.",
	'🕵️ Not a log. Showing the latest log instead.'
];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const REFUSED = `Refused to open "${REQUESTED}": not in the logs list`;

interface LogsPage {
	logs: LogEntry[];
	logFiles: LogFile[];
	selectedFile: string;
	rejectedFile: boolean;
}

/**
 * Flow:
 * 1. The user opens `/settings/logs?file=../data/profilarr.db`.
 *
 * Expects:
 * - the page data shows the newest log's entries
 * - nothing from the requested file is in the page data
 * - a warning alert shows one of the three messages
 * - a WARN log entry names the requested file
 */
test('a file outside the logs list is refused', async ({ app, page }) => {
	// Control: the requested file exists and is the app database
	expect(
		readFileSync(join(app.dir, 'data', 'profilarr.db'))
			.subarray(0, SQLITE_HEADER.length)
			.toString(),
		'control: the requested path should be the app database'
	).toBe(SQLITE_HEADER);

	await openPage(page, LOGS_URL);

	const data = await pageData<LogsPage>(page, LOGS_URL);
	const newest = data.logFiles[0]?.filename;
	expect(newest, 'control: the logs list should hold a log').toBeDefined();
	expect(
		{ selectedFile: data.selectedFile, rejectedFile: data.rejectedFile },
		'The page should refuse the file and select the newest log'
	).toEqual({ selectedFile: newest, rejectedFile: true });
	expect(data.logs.length, "The page should show the newest log's entries").toBeGreaterThan(0);

	// Lines are only appended, so a later read of the newest log starts with what the page got
	const later = await pageData<LogsPage>(page, '/settings/logs');
	expect(
		later.logs.slice(0, data.logs.length),
		"The page data should be the newest log's entries"
	).toEqual(data.logs);

	const raw = await (
		await page.request.get(`/settings/logs/__data.json?file=${encodeURIComponent(REQUESTED)}`)
	).text();
	expect(raw.includes(SQLITE_HEADER), 'Nothing from the database should reach the page data').toBe(
		false
	);

	await expect(
		page.getByRole('status').filter({ hasText: new RegExp(WARNINGS.map(escape).join('|')) }),
		'A warning alert should say the file is not a log'
	).toBeVisible();

	const refused = await logEntries(page, { source: 'settings/logs', message: REFUSED });
	expect(
		refused.map((entry) => ({ level: entry.level, meta: entry.meta })),
		'A WARN log entry should name the requested file'
	).toContainEqual({ level: 'WARN', meta: { file: REQUESTED } });
});
