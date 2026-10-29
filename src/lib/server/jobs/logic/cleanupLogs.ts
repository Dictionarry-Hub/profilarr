/**
 * Core cleanup logic for log files
 * Separated from job definition to avoid database/config dependencies for testing
 */

import * as fs from 'node:fs/promises';

export interface CleanupLogsResult {
	deletedCount: number;
	errorCount: number;
	errors: Array<{ file: string; error: unknown }>;
}

/**
 * Core cleanup logic - deletes log files older than retention period
 * Pure function that only depends on filesystem APIs
 *
 * @param logsDir Directory containing log files
 * @param retentionDays Number of days to retain logs
 * @returns Cleanup result with counts
 */
export async function cleanupLogs(
	logsDir: string,
	retentionDays: number
): Promise<CleanupLogsResult> {
	// Calculate cutoff date (YYYY-MM-DD format)
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
	const cutoffDateStr = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD

	let deletedCount = 0;
	let errorCount = 0;
	const errors: Array<{ file: string; error: unknown }> = [];

	// Regex to match daily log files: YYYY-MM-DD.log
	const dateLogPattern = /^(\d{4}-\d{2}-\d{2})\.log$/;

	try {
		for (const entry of await fs.readdir(logsDir, { withFileTypes: true })) {
			if (!entry.isFile()) continue;

			// Only process log files matching YYYY-MM-DD.log pattern
			const match = entry.name.match(dateLogPattern);
			if (!match) continue;

			const logDate = match[1]; // Extract YYYY-MM-DD from filename
			const filePath = `${logsDir}/${entry.name}`;

			try {
				// Compare date strings directly (YYYY-MM-DD format sorts correctly)
				if (logDate < cutoffDateStr) {
					await fs.rm(filePath);
					deletedCount++;
				}
			} catch (error) {
				errorCount++;
				errors.push({ file: entry.name, error });
			}
		}
	} catch (error) {
		// If we can't read the directory at all, that's a critical error
		// eslint-disable-next-line preserve-caught-error -- FIXME: pass the caught error as `cause`
		throw new Error(
			`Failed to read logs directory: ${error instanceof Error ? error.message : String(error)}`
		);
	}

	return { deletedCount, errorCount, errors };
}
