/**
 * Logger with console and file output
 * Supports configurable settings and daily rotation
 * Can run independently with provided config or use system defaults
 */

import * as fs from 'node:fs/promises';
import { config } from '#utils/config/config.ts';
import { colors } from './colors.ts';
import { logEvents } from './events.ts';
import { logSettings } from './settings.ts';
import type { LogEntry, LoggerConfig, LogLevel, LogOptions } from './types.ts';

class Logger {
	private config: Required<LoggerConfig>;

	constructor(config?: LoggerConfig) {
		// Use provided config or sensible defaults
		this.config = {
			logsDir: config?.logsDir ?? '/tmp/logs',
			enabled: config?.enabled ?? true,
			fileLogging: config?.fileLogging ?? true,
			consoleLogging: config?.consoleLogging ?? true,
			minLevel: config?.minLevel ?? 'DEBUG'
		};
	}

	private formatTimestamp(): string {
		const timestamp = new Date().toISOString();
		return `${colors.grey}${timestamp}${colors.reset}`;
	}

	private formatLevel(level: string, color: string): string {
		return `${color}${level.padEnd(5)}${colors.reset}`;
	}

	private formatSource(source?: string): string {
		if (!source) return '';
		return `${colors.grey}[${source}]${colors.reset}`;
	}

	private formatMeta(meta?: unknown): string {
		if (!meta) return '';
		return `${colors.grey}${JSON.stringify(meta)}${colors.reset}`;
	}

	/**
	 * Get log file path with daily rotation (YYYY-MM-DD.log)
	 */
	private getLogFilePath(): string {
		const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
		return `${this.config.logsDir}/${date}.log`;
	}

	/**
	 * Check if logging is enabled
	 */
	private isEnabled(): boolean {
		const currentSettings = logSettings.get();
		return currentSettings.enabled === 1;
	}

	/**
	 * Check if file logging is enabled
	 */
	private isFileLoggingEnabled(): boolean {
		const currentSettings = logSettings.get();
		return currentSettings.file_logging === 1;
	}

	/**
	 * Check if console logging is enabled
	 */
	private isConsoleLoggingEnabled(): boolean {
		const currentSettings = logSettings.get();
		return currentSettings.console_logging === 1;
	}

	/**
	 * Check if a log level should be logged based on minimum level
	 */
	private shouldLog(level: LogLevel): boolean {
		if (!this.isEnabled()) {
			return false;
		}

		// Get fresh settings from database instead of using cached config
		const currentSettings = logSettings.get();
		const currentMinLevel = currentSettings.min_level;

		const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
		const minIndex = levels.indexOf(currentMinLevel);
		const levelIndex = levels.indexOf(level);

		return levelIndex >= minIndex;
	}

	private async log(
		level: LogLevel,
		color: string,
		message: string,
		options?: LogOptions
	): Promise<void> {
		// Check if this log level should be logged
		if (!this.shouldLog(level)) {
			return;
		}

		const timestamp = new Date().toISOString();
		const logEntry: LogEntry = {
			timestamp,
			level,
			message,
			...(options?.source ? { source: options.source } : {}),
			...(options?.meta ? { meta: options.meta } : {})
		};

		// Live view on the Logs page, whether or not file logging is on
		logEvents.emit(logEntry);

		// Console output (colored)
		if (this.isConsoleLoggingEnabled()) {
			const consoleParts = [
				this.formatTimestamp(),
				this.formatLevel(level, color),
				message,
				options?.source ? this.formatSource(options.source) : '',
				options?.meta ? this.formatMeta(options.meta) : ''
			].filter(Boolean);

			console.log(consoleParts.join(' | '));
		}

		// File output (JSON)
		if (this.isFileLoggingEnabled()) {
			try {
				const filePath = this.getLogFilePath();

				// Ensure logs directory exists
				try {
					await fs.mkdir(this.config.logsDir, { recursive: true });
				} catch {
					// Directory might already exist
				}

				// Write to log file
				await fs.appendFile(filePath, JSON.stringify(logEntry) + '\n');
			} catch (error) {
				// If file write fails, at least we have console output
				console.error('Failed to write to log file:', error);
			}
		}
	}

	async debug(message: string, options?: LogOptions): Promise<void> {
		await this.log('DEBUG', colors.cyan, message, options);
	}

	async info(message: string, options?: LogOptions): Promise<void> {
		await this.log('INFO', colors.green, message, options);
	}

	async warn(message: string, options?: LogOptions): Promise<void> {
		await this.log('WARN', colors.yellow, message, options);
	}

	async error(message: string, options?: LogOptions): Promise<void> {
		await this.log('ERROR', colors.red, message, options);
	}

	async errorWithTrace(message: string, error?: Error, options?: LogOptions): Promise<void> {
		await this.log('ERROR', colors.red, message, options);

		// Print stack trace to console
		if (error?.stack && this.isConsoleLoggingEnabled()) {
			console.log(`${colors.grey}${error.stack}${colors.reset}`);
		}

		if (!error?.stack) return;

		const traceEntry: LogEntry = {
			timestamp: new Date().toISOString(),
			level: 'ERROR',
			message: 'Stack trace',
			meta: { stack: error.stack }
		};

		if (this.shouldLog('ERROR')) {
			logEvents.emit(traceEntry);
		}

		// Write stack trace to file
		if (this.isFileLoggingEnabled()) {
			try {
				const filePath = this.getLogFilePath();
				await fs.appendFile(filePath, JSON.stringify(traceEntry) + '\n');
			} catch (writeError) {
				console.error('Failed to write stack trace to log file:', writeError);
			}
		}
	}
}

// Export Logger class for creating custom instances (for testing)
export { Logger };

/**
 * Default logger singleton for production use
 * Uses system config and database settings
 *
 * For testing, create a standalone Logger instance:
 * @example
 * import { Logger } from './logger.ts';
 * const testLogger = new Logger({ logsDir: '/tmp/test-logs', minLevel: 'DEBUG' });
 * await testLogger.info('test message');
 */
const settings = logSettings.get();
export const logger = new Logger({
	logsDir: config.paths.logs,
	enabled: settings.enabled === 1,
	fileLogging: settings.file_logging === 1,
	consoleLogging: settings.console_logging === 1,
	minLevel: settings.min_level
});
