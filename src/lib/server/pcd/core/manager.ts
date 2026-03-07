/**
 * PCD Manager - High-level orchestration for PCD lifecycle
 */

import {
	checkForUpdates,
	checkout,
	clone,
	getStatus,
	pull,
	type GitStatus,
	type UpdateInfo
} from '$utils/git/index.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import type { DatabaseInstance, DatabaseInstancePublic } from '$db/queries/databaseInstances.ts';
import { loadManifest, type Manifest } from '../manifest/manifest.ts';
import { getPCDPath } from '../utils/operations.ts';
import {
	processDependencies,
	syncDependencies,
	validateDependencies
} from '../git/dependencies.ts';
import { compile, invalidate } from '../database/compiler.ts';
import { getCache } from '../database/registry.ts';
import { logger } from '$logger/logger.ts';
import { triggerSyncs } from '$sync/processor.ts';
import type { LinkOptions, SyncResult } from './types.ts';
import { importBaseOps } from '../ops/importBaseOps.ts';
import { cleanupJobsForDatabase } from '$lib/server/jobs/cleanup.ts';

/**
 * PCD Manager - Manages the lifecycle of Profilarr Compliant Databases
 */
class PCDManager {
	/**
	 * Link a new PCD repository
	 */
	async link(options: LinkOptions): Promise<DatabaseInstance> {
		await logger.debug('Starting database link operation', {
			source: 'PCDManager',
			meta: {
				name: options.name,
				repositoryUrl: options.repositoryUrl,
				branch: options.branch
			}
		});

		// Generate UUID for storage
		const uuid = crypto.randomUUID();
		const localPath = getPCDPath(uuid);

		try {
			// Clone the repository and detect if it's private
			const isPrivate = await clone(
				options.repositoryUrl,
				localPath,
				options.branch,
				options.personalAccessToken
			);

			// Validate manifest (loadManifest throws if invalid)
			await loadManifest(localPath);

			// Process dependencies (clone and validate)
			await processDependencies(localPath, options.personalAccessToken);

			// Insert into database
			const id = databaseInstancesQueries.create({
				uuid,
				name: options.name,
				repositoryUrl: options.repositoryUrl,
				localPath,
				syncStrategy: options.syncStrategy,
				autoPull: options.autoPull,
				personalAccessToken: options.personalAccessToken,
				isPrivate,
				localOpsEnabled: options.localOpsEnabled,
				gitUserName: options.gitUserName,
				gitUserEmail: options.gitUserEmail,
				conflictStrategy: options.conflictStrategy as 'override' | 'align' | 'ask' | undefined
			});

			// Get and return the created instance
			const instance = databaseInstancesQueries.getById(id);
			if (!instance) {
				throw new Error('Failed to retrieve created database instance');
			}

			try {
				await importBaseOps(id, localPath);
			} catch (error) {
				await logger.error('Failed to import base ops after linking', {
					source: 'PCDManager',
					meta: { error: String(error), databaseId: id }
				});
			}

			// Compile cache (only if enabled)
			if (instance.enabled) {
				try {
					const stats = await compile(localPath, id);

					await logger.debug(`Cache compiled for "${options.name}"`, {
						source: 'PCDManager',
						meta: {
							databaseId: id,
							schema: stats.schema,
							base: stats.base,
							tweaks: stats.tweaks,
							user: stats.user
						}
					});
				} catch (error) {
					// Log error but don't fail the link operation
					await logger.error('Failed to compile PCD cache after linking', {
						source: 'PCDManager',
						meta: { error: String(error), databaseId: id }
					});
				}
			}

			return instance;
		} catch (error) {
			// Cleanup on failure - remove cloned directory
			try {
				await Deno.remove(localPath, { recursive: true });
			} catch {
				// Ignore cleanup errors
			}
			throw error;
		}
	}

	/**
	 * Unlink a PCD repository
	 */
	async unlink(id: number): Promise<void> {
		const instance = databaseInstancesQueries.getById(id);
		if (!instance) {
			throw new Error(`Database instance ${id} not found`);
		}

		// Invalidate cache first
		invalidate(id);

		// Remove queued/scheduled jobs for this database
		cleanupJobsForDatabase(id);

		// Delete from database
		databaseInstancesQueries.delete(id);

		// Then cleanup filesystem
		try {
			await Deno.remove(instance.local_path, { recursive: true });
		} catch (error) {
			// Log but don't throw - database entry is already deleted
			// nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring — JS template literals don't interpret format specifiers
			console.error(`Failed to remove PCD directory ${instance.local_path}:`, error);
		}
	}

	/**
	 * Sync a PCD repository (pull updates)
	 */
	async sync(id: number): Promise<SyncResult> {
		const instance = databaseInstancesQueries.getById(id);
		if (!instance) {
			throw new Error(`Database instance ${id} not found`);
		}

		try {
			// Check for updates first
			const updateInfo = await checkForUpdates(instance.local_path);

			if (!updateInfo.hasUpdates) {
				// Already up to date
				databaseInstancesQueries.updateSyncedAt(id);
				return {
					success: true,
					commitsBehind: 0
				};
			}

			// Pull updates
			await pull(instance.local_path);

			// Sync dependencies (schema, etc.) if versions changed
			await syncDependencies(instance.local_path, instance.personal_access_token ?? undefined);

			try {
				await importBaseOps(id, instance.local_path);
			} catch (error) {
				await logger.error('Failed to import base ops after sync', {
					source: 'PCDManager',
					meta: { error: String(error), databaseId: id }
				});
			}

			// Update last_synced_at
			databaseInstancesQueries.updateSyncedAt(id);

			// Recompile cache (only if enabled)
			if (instance.enabled) {
				try {
					await compile(instance.local_path, id);
				} catch (error) {
					await logger.error('Failed to recompile PCD cache after sync', {
						source: 'PCDManager',
						meta: { error: String(error), databaseId: id }
					});
				}
			}

			// Trigger arr syncs for configs with on_pull trigger
			await triggerSyncs({ event: 'on_pull', databaseId: id });

			return {
				success: true,
				commitsBehind: updateInfo.commitsBehind
			};
		} catch (error) {
			return {
				success: false,
				commitsBehind: 0,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Check for available updates without pulling
	 */
	async checkForUpdates(id: number): Promise<UpdateInfo> {
		const instance = databaseInstancesQueries.getById(id);
		if (!instance) {
			throw new Error(`Database instance ${id} not found`);
		}

		return await checkForUpdates(instance.local_path);
	}

	/**
	 * Get parsed manifest for a PCD
	 */
	async getManifest(id: number): Promise<Manifest> {
		const instance = databaseInstancesQueries.getById(id);
		if (!instance) {
			throw new Error(`Database instance ${id} not found`);
		}

		return await loadManifest(instance.local_path);
	}

	/**
	 * Switch branch for a PCD
	 */
	async switchBranch(id: number, branch: string): Promise<void> {
		const instance = databaseInstancesQueries.getById(id);
		if (!instance) {
			throw new Error(`Database instance ${id} not found`);
		}

		await checkout(instance.local_path, branch);
		await pull(instance.local_path);
		try {
			await importBaseOps(id, instance.local_path);
		} catch (error) {
			await logger.error('Failed to import base ops after branch switch', {
				source: 'PCDManager',
				meta: { error: String(error), databaseId: id }
			});
		}
		databaseInstancesQueries.updateSyncedAt(id);
	}

	/**
	 * Get git status for a PCD
	 */
	async getStatus(id: number): Promise<GitStatus> {
		const instance = databaseInstancesQueries.getById(id);
		if (!instance) {
			throw new Error(`Database instance ${id} not found`);
		}

		return await getStatus(instance.local_path);
	}

	/**
	 * Get all PCDs
	 */
	getAll(): DatabaseInstance[] {
		return databaseInstancesQueries.getAll();
	}

	/**
	 * Get all PCDs with secrets stripped (for frontend use)
	 */
	getAllPublic(): DatabaseInstancePublic[] {
		return databaseInstancesQueries.getAll().map(({ personal_access_token, ...safe }) => ({
			...safe,
			hasPat: personal_access_token !== null
		}));
	}

	/**
	 * Get PCD by ID
	 */
	getById(id: number): DatabaseInstance | undefined {
		return databaseInstancesQueries.getById(id);
	}

	/**
	 * Get PCD by ID with secrets stripped (for frontend use)
	 */
	getByIdPublic(id: number): DatabaseInstancePublic | undefined {
		const instance = databaseInstancesQueries.getById(id);
		if (!instance) return undefined;
		const { personal_access_token, ...safe } = instance;
		return { ...safe, hasPat: personal_access_token !== null };
	}

	/**
	 * Get PCDs that need auto-sync
	 */
	getDueForSync(): DatabaseInstance[] {
		return databaseInstancesQueries.getDueForSync();
	}

	/**
	 * Initialize PCD caches for all enabled databases
	 * Should be called on application startup
	 */
	async initialize(): Promise<void> {
		const startTime = performance.now();

		await logger.debug('Initialize caches', { source: 'PCDManager' });

		const instances = databaseInstancesQueries.getAll();
		const enabledInstances = instances.filter((instance) => instance.enabled);

		// Validate dependencies for all instances first
		for (const instance of enabledInstances) {
			try {
				await validateDependencies(
					instance.local_path,
					instance.personal_access_token ?? undefined
				);
			} catch (error) {
				await logger.error(`Failed to validate dependencies for "${instance.name}"`, {
					source: 'PCDManager',
					meta: { error: String(error), databaseId: instance.id }
				});
			}
		}

		// Import base ops from repo for all enabled instances
		for (const instance of enabledInstances) {
			try {
				await importBaseOps(instance.id, instance.local_path);
			} catch (error) {
				await logger.error(`Failed to import base ops for "${instance.name}"`, {
					source: 'PCDManager',
					meta: { error: String(error), databaseId: instance.id }
				});
			}
		}

		// Collect results for aggregate logging
		const results: Array<{
			name: string;
			schema: number;
			base: number;
			tweaks: number;
			user: number;
			error?: string;
		}> = [];

		// Compile all enabled instances
		for (const instance of enabledInstances) {
			try {
				const stats = await compile(instance.local_path, instance.id);

				results.push({
					name: instance.name,
					schema: stats.schema,
					base: stats.base,
					tweaks: stats.tweaks,
					user: stats.user
				});
			} catch (error) {
				results.push({
					name: instance.name,
					schema: 0,
					base: 0,
					tweaks: 0,
					user: 0,
					error: String(error)
				});

				await logger.error(`Cache failed "${instance.name}"`, {
					source: 'PCDManager',
					meta: { error: String(error), databaseId: instance.id }
				});
			}
		}

		const timing = Math.round(performance.now() - startTime);
		const successful = results.filter((r) => !r.error);

		await logger.info('Caches ready', {
			source: 'PCDManager',
			meta: {
				databases: successful.map((r) => ({
					name: r.name,
					schema: r.schema,
					base: r.base,
					tweaks: r.tweaks,
					user: r.user
				})),
				timing: `${timing}ms`
			}
		});
	}

	/**
	 * Get the cache for a database instance
	 */
	getCache(id: number) {
		return getCache(id);
	}
}

// Export singleton instance
export const pcdManager = new PCDManager();
