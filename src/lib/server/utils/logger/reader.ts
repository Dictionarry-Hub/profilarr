/**
 * Log file reader utility
 * Provides functions to read and parse log files
 * Supports reading from multiple files (for daily rotation)
 */

import * as fs from 'node:fs/promises';
import { config } from '$config';
import type { LogEntry } from './types.ts';

/**
 * Get all log files sorted by modification time (newest first)
 */
async function getLogFiles(): Promise<string[]> {
	const logsDir = config.paths.logs;
	const logFiles: Array<{ path: string; mtime: Date }> = [];

	try {
		for (const entry of await fs.readdir(logsDir, { withFileTypes: true })) {
			if (entry.isFile() && entry.name.endsWith('.log')) {
				const filePath = `${logsDir}/${entry.name}`;
				try {
					const stat = await fs.stat(filePath);
					if (stat.mtime) {
						logFiles.push({ path: filePath, mtime: stat.mtime });
					}
				} catch {
					// Skip files we can't stat
				}
			}
		}
	} catch {
		// If directory doesn't exist, return empty array
		return [];
	}

	// Sort by modification time (newest first)
	logFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

	return logFiles.map((f) => f.path);
}

/**
 * Get all log files with metadata
 */
export async function getLogFilesList(): Promise<
	Array<{ filename: string; path: string; size: number; modified: Date }>
> {
	const logsDir = config.paths.logs;
	const logFiles: Array<{ filename: string; path: string; size: number; modified: Date }> = [];

	try {
		for (const entry of await fs.readdir(logsDir, { withFileTypes: true })) {
			if (entry.isFile() && entry.name.endsWith('.log')) {
				const filePath = `${logsDir}/${entry.name}`;
				try {
					const stat = await fs.stat(filePath);
					if (stat.mtime) {
						logFiles.push({
							filename: entry.name,
							path: filePath,
							size: stat.size,
							modified: stat.mtime
						});
					}
				} catch {
					// Skip files we can't stat
				}
			}
		}
	} catch {
		// If directory doesn't exist, return empty array
		return [];
	}

	// Sort by modification time (newest first)
	logFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());

	return logFiles;
}

/**
 * Read logs from a specific file
 * @param filename Name of the log file to read
 * @returns Array of log entries sorted by timestamp (oldest first)
 */
export async function readLogsFromFile(filename: string): Promise<LogEntry[]> {
	try {
		const logsDir = config.paths.logs;
		const filePath = `${logsDir}/${filename}`;
		const logs: LogEntry[] = [];

		const content = await fs.readFile(filePath, 'utf8');
		const lines = content.split('\n').filter((line) => line.trim());

		// Parse each line as JSON
		for (const line of lines) {
			try {
				const entry = JSON.parse(line) as LogEntry;
				logs.push(entry);
			} catch {
				// Skip invalid JSON lines
			}
		}

		// Sort by timestamp (oldest first)
		logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

		return logs;
	} catch (_error) {
		// If anything fails, return empty array
		return [];
	}
}

/**
 * Read all logs from all log files
 * @returns Array of log entries sorted by timestamp (oldest first)
 */
export async function readLastLogs(): Promise<LogEntry[]> {
	try {
		const logFiles = await getLogFiles();
		const logs: LogEntry[] = [];

		// Read from all log files
		for (const filePath of logFiles) {
			try {
				const content = await fs.readFile(filePath, 'utf8');
				const lines = content.split('\n').filter((line) => line.trim());

				// Parse each line as JSON
				for (const line of lines) {
					try {
						const entry = JSON.parse(line) as LogEntry;
						logs.push(entry);
					} catch {
						// Skip invalid JSON lines
					}
				}
			} catch {
				// Skip files we can't read
			}
		}

		// Sort by timestamp (oldest first)
		logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

		return logs;
	} catch (_error) {
		// If anything fails, return empty array
		return [];
	}
}

/**
 * Parse a log line from the file
 * @param line Raw log line (JSON string)
 * @returns Parsed log entry or null if invalid
 */
export function parseLogLine(line: string): LogEntry | null {
	try {
		const trimmed = line.trim();
		if (!trimmed) return null;
		return JSON.parse(trimmed) as LogEntry;
	} catch {
		return null;
	}
}

/**
 * Filter options for reading logs
 */
export interface LogFilterOptions {
	source?: string;
	instanceId?: number;
}

/**
 * Read logs filtered by source and/or instanceId
 * @param options Filter options
 * @returns Array of filtered log entries (newest first)
 */
export async function readFilteredLogs(options: LogFilterOptions = {}): Promise<LogEntry[]> {
	const { source, instanceId } = options;

	try {
		const logFiles = await getLogFiles();
		const logs: LogEntry[] = [];

		// Read from all log files
		for (const filePath of logFiles) {
			try {
				const content = await fs.readFile(filePath, 'utf8');
				const lines = content.split('\n').filter((line) => line.trim());

				// Parse each line as JSON
				for (const line of lines) {
					try {
						const entry = JSON.parse(line) as LogEntry;

						// Apply filters
						if (source && entry.source !== source) {
							continue;
						}

						if (instanceId !== undefined && entry.meta) {
							const meta = entry.meta as Record<string, unknown>;
							if (meta.instanceId !== instanceId) {
								continue;
							}
						}

						logs.push(entry);
					} catch {
						// Skip invalid JSON lines
					}
				}
			} catch {
				// Skip files we can't read
			}
		}

		// Sort by timestamp (newest first)
		logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

		return logs;
	} catch (_error) {
		// If anything fails, return empty array
		return [];
	}
}
