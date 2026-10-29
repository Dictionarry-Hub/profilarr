import { logSettingsQueries } from '#db/queries/logSettings.ts';
import type { LogSettings } from '#db/queries/logSettings.ts';

/**
 * Log settings manager
 * Loads and caches log settings from database
 */
class LogSettingsManager {
	private settings: LogSettings | null = null;
	private initialized = false;

	/**
	 * Load settings from database
	 */
	load(): void {
		try {
			this.settings = logSettingsQueries.get() ?? null;
			this.initialized = true;
		} catch (error) {
			console.error('Failed to load log settings:', error);
			// Use defaults if database not available
			this.settings = null;
			this.initialized = false;
		}
	}

	/**
	 * Reload settings from database
	 * Call this after updating settings
	 */
	reload(): void {
		this.load();
	}

	/**
	 * Get current settings
	 * Returns defaults if not loaded
	 */
	get(): LogSettings {
		if (!this.initialized || !this.settings) {
			// Return defaults if not initialized
			return {
				id: 1,
				retention_days: 30,
				min_level: 'DEBUG',
				enabled: 1,
				file_logging: 1,
				console_logging: 1,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			};
		}
		return this.settings;
	}

	/**
	 * Check if logging is enabled
	 */
	isEnabled(): boolean {
		return this.get().enabled === 1;
	}

	/**
	 * Check if file logging is enabled
	 */
	isFileLoggingEnabled(): boolean {
		return this.get().file_logging === 1;
	}

	/**
	 * Check if console logging is enabled
	 */
	isConsoleLoggingEnabled(): boolean {
		return this.get().console_logging === 1;
	}

	/**
	 * Get minimum log level
	 */
	getMinLevel(): 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' {
		return this.get().min_level;
	}

	/**
	 * Check if a log level should be logged
	 */
	shouldLog(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'): boolean {
		if (!this.isEnabled()) {
			return false;
		}

		const minLevel = this.getMinLevel();
		const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
		const minIndex = levels.indexOf(minLevel);
		const levelIndex = levels.indexOf(level);

		return levelIndex >= minIndex;
	}
}

// Export singleton instance
export const logSettings = new LogSettingsManager();
