/**
 * PCD Cache - In-memory compiled view of PCD operations
 */

import { Database } from '@db/sqlite';
import { Kysely } from 'kysely';
// @ts-ignore - Deno JSR import not recognized by svelte-check
import { DenoSqlite3Dialect } from '@soapbox/kysely-deno-sqlite';
import { logger } from '$logger/logger.ts';
import { loadAllOperations } from '../ops/loadOps.ts';
import { validateOperations } from '../utils/operations.ts';
import {
	databaseInstancesQueries,
	disableDatabaseInstance
} from '$db/queries/databaseInstances.ts';
import { pcdOpHistoryQueries } from '$db/queries/pcdOpHistory.ts';
import { pcdOpsQueries } from '$db/queries/pcdOps.ts';
import type { PCDDatabase } from '$shared/pcd/types.ts';
import type { CacheBuildStats, ValidationResult } from '../core/types.ts';
import { uuid } from '$shared/utils/uuid.ts';
import type { PcdOpHistoryStatus } from '$db/queries/pcdOpHistory.ts';
import {
	evaluateAutoAlign,
	parseDesiredState,
	parseOpMetadata
} from '$pcd/conflicts/autoAlign/index.ts';
import { checkFullListConflict } from '$pcd/conflicts/fullListCheck.ts';

/**
 * PCDCache - Manages an in-memory compiled database for a single PCD
 */
export class PCDCache {
	private db: Database | null = null;
	private kysely: Kysely<PCDDatabase> | null = null;
	private pcdPath: string;
	private databaseInstanceId: number;
	private built = false;

	constructor(pcdPath: string, databaseInstanceId: number) {
		this.pcdPath = pcdPath;
		this.databaseInstanceId = databaseInstanceId;
	}

	/**
	 * Build the cache by executing all operations in layer order
	 * Returns stats about what was loaded
	 */
	async build(): Promise<CacheBuildStats> {
		const startTime = performance.now();
		const batchId = uuid();
		const instance = databaseInstancesQueries.getById(this.databaseInstanceId);
		const conflictStrategy = (instance?.conflict_strategy ?? 'override') as
			| 'override'
			| 'align'
			| 'ask';
		const userOps = pcdOpsQueries.listByDatabaseAndOrigin(this.databaseInstanceId, 'user', {
			states: ['published']
		});
		const userOpsById = new Map(userOps.map((op) => [op.id, op]));
		const priorConflicts = new Map<number, string | null>();
		try {
			const latestConflicts = pcdOpHistoryQueries.listLatestByDatabaseWithOps(
				this.databaseInstanceId,
				['conflicted', 'conflicted_pending']
			);
			for (const entry of latestConflicts) {
				priorConflicts.set(entry.history.op_id, entry.history.conflict_reason);
			}
		} catch (error) {
			await logger.warn('Failed to load prior conflicts', {
				source: 'PCDCache',
				meta: {
					error: String(error),
					databaseInstanceId: this.databaseInstanceId
				}
			});
		}

		try {
			// 1. Create in-memory database
			// Enable int64 mode to properly handle large integers (e.g., file sizes in bytes)
			this.db = new Database(':memory:', { int64: true });

			// Enable foreign keys
			this.db.exec('PRAGMA foreign_keys = ON');

			// Initialize Kysely query builder
			this.kysely = new Kysely<PCDDatabase>({
				dialect: new DenoSqlite3Dialect({
					database: this.db
				})
			});

			// 2. Register helper functions
			this.registerHelperFunctions();

			// 3. Load all operations
			const operations = await loadAllOperations(this.pcdPath, this.databaseInstanceId);
			validateOperations(operations);

			// Count ops per layer
			const stats: CacheBuildStats = {
				schema: operations.filter((o) => o.layer === 'schema').length,
				base: operations.filter((o) => o.layer === 'base').length,
				tweaks: operations.filter((o) => o.layer === 'tweaks').length,
				user: operations.filter((o) => o.layer === 'user').length,
				timing: 0
			};

			// 4. Execute operations in order
			for (const operation of operations) {
				const opId = parseOpId(operation.filepath);
				const trackHistory = opId !== null;
				const userOp = trackHistory ? userOpsById.get(opId) : undefined;
				const isUserOp = !!userOp;
				const beforeChanges = trackHistory ? this.db!.totalChanges : 0;
				try {
					this.db.exec(operation.sql);
					if (trackHistory) {
						const rowcount = this.db!.totalChanges - beforeChanges;
						try {
							let status: PcdOpHistoryStatus = rowcount === 0 ? 'skipped' : 'applied';
							let conflictReason: string | null = null;

							if (rowcount === 0 && isUserOp) {
								const metadata = parseOpMetadata(userOp?.metadata ?? null);
								const desiredState = parseDesiredState(userOp?.desired_state ?? null);
								const autoAlignDecision = evaluateAutoAlign({
									db: this.db!,
									conflictStrategy,
									metadata,
									desiredState
								});

								if (autoAlignDecision.shouldAlign) {
									const updated = pcdOpsQueries.update(opId, {
										state: 'dropped'
									});
									if (updated) {
										status = 'dropped';
										conflictReason = 'aligned';
										await logger.info(
											autoAlignDecision.reason === 'forced'
												? 'Forced align conflict'
												: 'Auto-aligned conflict',
											{
												source: 'PCDCache',
												meta: {
													opId,
													databaseInstanceId: this.databaseInstanceId,
													conflictStrategy,
													conflictReason,
													autoAlignReason: autoAlignDecision.reason,
													autoAlignRule: autoAlignDecision.rule
												}
											}
										);
									}
								}

								if (status !== 'dropped') {
									status = conflictStrategy === 'ask' ? 'conflicted_pending' : 'conflicted';
									conflictReason = getConflictReason(metadata);
									const priorReason = priorConflicts.get(opId);
									if (priorReason !== conflictReason) {
										await logger.info('Recorded op conflict', {
											source: 'PCDCache',
											meta: {
												opId,
												databaseInstanceId: this.databaseInstanceId,
												conflictStrategy,
												conflictReason
											}
										});
									}
								}
							}

							// Multi-statement ops can have rowcount > 0 even when
							// some guards failed (e.g. DELETEs fail but INSERTs
							// succeed). Detect this by checking whether the DB
							// state matches the desired "to" state.
							if (status === 'applied' && isUserOp) {
								const metadata = parseOpMetadata(userOp?.metadata ?? null);
								const desiredState = parseDesiredState(userOp?.desired_state ?? null);
								const conflict = checkFullListConflict(this.db!, metadata, desiredState);
								if (conflict) {
									if (conflictStrategy === 'align') {
										const updated = pcdOpsQueries.update(opId, { state: 'dropped' });
										if (updated) {
											status = 'dropped';
											conflictReason = 'aligned';
											stats.needsRebuild = true;
											await logger.info('Forced align conflict (full-list mismatch)', {
												source: 'PCDCache',
												meta: {
													opId,
													databaseInstanceId: this.databaseInstanceId,
													conflictStrategy,
													conflictReason
												}
											});
										}
									}
									if (status !== 'dropped') {
										status = conflictStrategy === 'ask' ? 'conflicted_pending' : 'conflicted';
										conflictReason = 'guard_mismatch';
										const priorReason = priorConflicts.get(opId);
										if (priorReason !== conflictReason) {
											await logger.info('Recorded op conflict (full-list mismatch)', {
												source: 'PCDCache',
												meta: {
													opId,
													databaseInstanceId: this.databaseInstanceId,
													conflictStrategy,
													conflictReason
												}
											});
										}
									}
								}
							}

							pcdOpHistoryQueries.create({
								opId,
								databaseId: this.databaseInstanceId,
								batchId,
								status,
								rowcount,
								conflictReason
							});
						} catch (historyError) {
							await logger.warn('Failed to record op history', {
								source: 'PCDCache',
								meta: {
									opId,
									databaseInstanceId: this.databaseInstanceId,
									error: String(historyError)
								}
							});
						}
					}
				} catch (error) {
					const errorStr = String(error);
					const isDuplicateKey = isUserOp && isUniqueConstraintError(errorStr);
					const isMissingTarget = isUserOp && isForeignKeyConstraintError(errorStr);
					const shouldRecordConflict = trackHistory && (isDuplicateKey || isMissingTarget);

					if (shouldRecordConflict) {
						let status: PcdOpHistoryStatus =
							conflictStrategy === 'ask' ? 'conflicted_pending' : 'conflicted';
						let conflictReason = isDuplicateKey ? 'duplicate_key' : 'missing_target';
						if (conflictStrategy === 'align') {
							const updated = pcdOpsQueries.update(opId, { state: 'dropped' });
							if (updated) {
								status = 'dropped';
								conflictReason = 'aligned';
								stats.needsRebuild = true;
								await logger.info('Forced align conflict', {
									source: 'PCDCache',
									meta: {
										opId,
										databaseInstanceId: this.databaseInstanceId,
										conflictStrategy,
										conflictReason
									}
								});
							}
						}
						const priorReason = priorConflicts.get(opId);
						if (priorReason !== conflictReason) {
							await logger.info('Recorded op conflict', {
								source: 'PCDCache',
								meta: {
									opId,
									databaseInstanceId: this.databaseInstanceId,
									conflictStrategy,
									conflictReason
								}
							});
						}
						try {
							pcdOpHistoryQueries.create({
								opId,
								databaseId: this.databaseInstanceId,
								batchId,
								status,
								rowcount: 0,
								conflictReason,
								error: errorStr,
								details: JSON.stringify({
									layer: operation.layer,
									filename: operation.filename
								})
							});
						} catch (historyError) {
							await logger.warn('Failed to record op history', {
								source: 'PCDCache',
								meta: {
									opId,
									databaseInstanceId: this.databaseInstanceId,
									error: String(historyError)
								}
							});
						}
						continue;
					}
					if (trackHistory) {
						try {
							pcdOpHistoryQueries.create({
								opId,
								databaseId: this.databaseInstanceId,
								batchId,
								status: 'error',
								rowcount: null,
								error: errorStr,
								details: JSON.stringify({
									layer: operation.layer,
									filename: operation.filename
								})
							});
						} catch (historyError) {
							await logger.warn('Failed to record op history', {
								source: 'PCDCache',
								meta: {
									opId,
									databaseInstanceId: this.databaseInstanceId,
									error: String(historyError)
								}
							});
						}
					}
					throw new Error(
						`Failed to execute operation ${operation.filename} in ${operation.layer} layer: ${error}`
					);
				}
			}

			this.built = true;
			stats.timing = Math.round(performance.now() - startTime);

			return stats;
		} catch (error) {
			await logger.error('Failed to build PCD cache', {
				source: 'PCDCache',
				meta: {
					error: String(error),
					databaseInstanceId: this.databaseInstanceId
				}
			});

			// Disable the database instance
			await disableDatabaseInstance(this.databaseInstanceId);

			// Clean up
			this.close();
			throw error;
		}
	}

	/**
	 * Register SQL helper functions (qp, cf, dp, tag)
	 */
	private registerHelperFunctions(): void {
		if (!this.db) return;

		// qp(name) - Quality profile lookup by name
		this.db.function('qp', (name: string) => {
			const result = this.db!.prepare('SELECT id FROM quality_profiles WHERE name = ?').get(
				name
			) as { id: number } | undefined;
			if (!result) {
				throw new Error(`Quality profile not found: ${name}`);
			}
			return result.id;
		});

		// cf(name) - Custom format lookup by name
		this.db.function('cf', (name: string) => {
			const result = this.db!.prepare('SELECT id FROM custom_formats WHERE name = ?').get(name) as
				| { id: number }
				| undefined;
			if (!result) {
				throw new Error(`Custom format not found: ${name}`);
			}
			return result.id;
		});

		// dp(name) - Delay profile lookup by name
		this.db.function('dp', (name: string) => {
			const result = this.db!.prepare('SELECT id FROM delay_profiles WHERE name = ?').get(name) as
				| { id: number }
				| undefined;
			if (!result) {
				throw new Error(`Delay profile not found: ${name}`);
			}
			return result.id;
		});

		// tag(name) - Tag lookup by name (creates if not exists)
		this.db.function('tag', (name: string) => {
			const result = this.db!.prepare('SELECT id FROM tags WHERE name = ?').get(name) as
				| { id: number }
				| undefined;
			if (!result) {
				throw new Error(`Tag not found: ${name}`);
			}
			return result.id;
		});
	}

	/**
	 * Check if cache is built and ready
	 */
	isBuilt(): boolean {
		return this.built && this.db !== null;
	}

	/**
	 * Close the database connection
	 */
	close(): void {
		if (this.kysely) {
			this.kysely.destroy();
			this.kysely = null;
		}
		if (this.db) {
			this.db.close();
			this.db = null;
		}
		this.built = false;
	}

	/**
	 * Get the Kysely query builder
	 * Use this for type-safe queries
	 */
	get kb(): Kysely<PCDDatabase> {
		if (!this.kysely) {
			throw new Error('Cache not built');
		}
		return this.kysely;
	}

	// ============================================================================
	// QUERY API
	// ============================================================================

	/**
	 * Execute a raw SQL query and return all rows
	 * Use this in your query functions in pcd/queries/*.ts
	 */
	query<T = unknown>(
		sql: string,
		...params: (string | number | null | boolean | Uint8Array)[]
	): T[] {
		if (!this.isBuilt()) {
			throw new Error('Cache not built');
		}

		return this.db!.prepare(sql).all(...params) as T[];
	}

	/**
	 * Execute a raw SQL query and return a single row
	 * Use this in your query functions in pcd/queries/*.ts
	 */
	queryOne<T = unknown>(
		sql: string,
		...params: (string | number | null | boolean | Uint8Array)[]
	): T | undefined {
		if (!this.isBuilt()) {
			throw new Error('Cache not built');
		}

		return this.db!.prepare(sql).get(...params) as T | undefined;
	}

	/**
	 * Validate SQL statements by doing a dry-run in a transaction
	 * Returns null if valid, or an error message if invalid
	 *
	 * This is a safety check before writing operations to files.
	 * It catches FK violations, constraint errors, etc.
	 */
	validateSql(sqlStatements: string[]): ValidationResult {
		if (!this.isBuilt()) {
			return { valid: false, error: 'Cache not built' };
		}

		try {
			// Start a savepoint (nested transaction)
			this.db!.exec('SAVEPOINT validation_check');

			try {
				// Try to execute each statement
				for (const sql of sqlStatements) {
					this.db!.exec(sql);
				}

				// All statements executed successfully
				return { valid: true };
			} finally {
				// Always rollback - this is just a validation check
				this.db!.exec('ROLLBACK TO SAVEPOINT validation_check');
				this.db!.exec('RELEASE SAVEPOINT validation_check');
			}
		} catch (error) {
			// Parse the error to provide a helpful message
			const errorStr = String(error);

			// Common SQLite constraint errors
			if (errorStr.includes('FOREIGN KEY constraint failed')) {
				return {
					valid: false,
					error: `Foreign key constraint failed - referenced entity does not exist. ${errorStr}`
				};
			}
			if (errorStr.includes('UNIQUE constraint failed')) {
				return {
					valid: false,
					error: `Unique constraint failed - duplicate entry. ${errorStr}`
				};
			}
			if (errorStr.includes('NOT NULL constraint failed')) {
				return {
					valid: false,
					error: `Required field is missing. ${errorStr}`
				};
			}
			if (errorStr.includes('CHECK constraint failed')) {
				return {
					valid: false,
					error: `Value validation failed. ${errorStr}`
				};
			}

			return {
				valid: false,
				error: `Database validation failed: ${errorStr}`
			};
		}
	}
}

function parseOpId(filepath: string): number | null {
	if (!filepath.startsWith('pcd_ops:')) return null;
	const raw = filepath.slice('pcd_ops:'.length);
	const opId = Number(raw);
	return Number.isFinite(opId) ? opId : null;
}

function getConflictReason(metadata: ReturnType<typeof parseOpMetadata>): string {
	switch (metadata?.operation) {
		case 'create':
			return 'duplicate_key';
		case 'delete':
			// All entities use name-only delete guards. A delete that affects 0
			// rows means the row is gone (renamed or deleted upstream).
			return 'missing_target';
		case 'update':
		default:
			return 'guard_mismatch';
	}
}

function isUniqueConstraintError(errorStr: string): boolean {
	return errorStr.includes('UNIQUE constraint failed');
}

function isForeignKeyConstraintError(errorStr: string): boolean {
	return errorStr.includes('FOREIGN KEY constraint failed');
}
