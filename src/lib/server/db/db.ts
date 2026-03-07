import { Database } from '@jsr/db__sqlite';
import type { RestBindParameters } from '@jsr/db__sqlite';
import { config } from '$config';
import { logger } from '$logger/logger.ts';

/**
 * Database singleton for SQLite
 */
class DatabaseManager {
	private db: Database | null = null;
	private initialized = false;

	/**
	 * Check if the database connection is healthy
	 */
	private isHealthy(): boolean {
		if (!this.db || !this.initialized) {
			return false;
		}

		try {
			// Try a simple query to verify connection is alive
			this.db.prepare('SELECT 1').get();
			return true;
		} catch {
			// Connection is broken
			return false;
		}
	}

	/**
	 * Initialize the database connection
	 */
	async initialize(): Promise<void> {
		// Check if already initialized and healthy
		if (this.initialized && this.isHealthy()) {
			return;
		}

		// If initialized but unhealthy, close and reinitialize (HMR recovery)
		if (this.initialized && !this.isHealthy()) {
			await logger.warn('Database connection unhealthy, reinitializing', {
				source: 'DatabaseManager',
				meta: { path: config.paths.database }
			});
			this.close();
		}

		try {
			// Ensure data directory exists
			await Deno.mkdir(config.paths.data, { recursive: true });

			// Check if database exists before opening
			const dbExists = await Deno.stat(config.paths.database)
				.then(() => true)
				.catch(() => false);

			if (!dbExists) {
				await logger.debug('Creating new database', {
					source: 'DatabaseManager',
					meta: { path: config.paths.database }
				});
			}

			// Open database connection
			this.db = new Database(config.paths.database);

			// Enable foreign keys
			this.db.exec('PRAGMA foreign_keys = ON');

			// Set journal mode to WAL for better concurrency
			this.db.exec('PRAGMA journal_mode = WAL');

			// Set synchronous to NORMAL for better performance
			this.db.exec('PRAGMA synchronous = NORMAL');

			this.initialized = true;

			await logger.debug('Database initialized', {
				source: 'DatabaseManager',
				meta: { path: config.paths.database }
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await logger.error(`Failed to initialize database: ${message}`, {
				source: 'DatabaseManager',
				meta: error
			});
			throw new Error(`Failed to initialize database: ${message}`);
		}
	}

	/**
	 * Get the database instance
	 */
	getDatabase(): Database {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}
		return this.db;
	}

	/**
	 * Execute a SQL statement
	 */
	exec(sql: string): void {
		const db = this.getDatabase();
		db.exec(sql); // nosemgrep: profilarr.sql.exec-with-variable — internal API, callers are trusted
	}

	/**
	 * Prepare a SQL statement
	 */
	prepare(sql: string) {
		const db = this.getDatabase();
		return db.prepare(sql);
	}

	/**
	 * Run a query and return all results
	 */
	query<T = unknown>(sql: string, ...params: RestBindParameters): T[] {
		const stmt = this.prepare(sql);
		if (params.length > 0) {
			return stmt.all(...params) as T[];
		}
		return stmt.all() as T[];
	}

	/**
	 * Run a query and return the first result
	 */
	queryFirst<T = unknown>(sql: string, ...params: RestBindParameters): T | undefined {
		const stmt = this.prepare(sql);
		if (params.length > 0) {
			return stmt.get(...params) as T | undefined;
		}
		return stmt.get() as T | undefined;
	}

	/**
	 * Execute a statement and return the number of affected rows
	 */
	execute(sql: string, ...params: RestBindParameters): number {
		const stmt = this.prepare(sql);
		if (params.length > 0) {
			stmt.run(...params);
		} else {
			stmt.run();
		}
		return this.getDatabase().changes;
	}

	/**
	 * Begin a transaction
	 */
	beginTransaction(): void {
		this.exec('BEGIN TRANSACTION');
	}

	/**
	 * Commit a transaction
	 */
	commit(): void {
		this.exec('COMMIT');
	}

	/**
	 * Rollback a transaction
	 */
	rollback(): void {
		this.exec('ROLLBACK');
	}

	/**
	 * Run a function within a transaction
	 */
	async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
		this.beginTransaction();
		try {
			const result = await fn();
			this.commit();
			return result;
		} catch (error) {
			this.rollback();
			await logger.error('Transaction rolled back due to error', {
				source: 'DatabaseManager',
				meta: error
			});
			throw error;
		}
	}

	/**
	 * Close the database connection
	 */
	close(): void {
		if (this.db) {
			this.db.close();
			this.db = null;
			this.initialized = false;
		}
	}
}

// Export singleton instance
export const db = new DatabaseManager();
