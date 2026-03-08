/**
 * Rename processor - orchestrates file and folder renames for Radarr/Sonarr
 *
 * Uses a generic adapter pattern so the same flow works for both arr types.
 * The processor is called by the job handler (arrRename.ts).
 *
 * Pure processing logic lives in core.ts (testable without DB).
 * This file wires it together with client creation, logging, and notifications.
 */

import { createArrClient } from '$lib/server/utils/arr/factory.ts';
import type { RadarrClient } from '$lib/server/utils/arr/clients/radarr.ts';
import type { SonarrClient } from '$lib/server/utils/arr/clients/sonarr.ts';
import type { RenameSettings } from '$db/queries/arrRenameSettings.ts';
import type { ArrInstance } from '$db/queries/arrInstances.ts';
import type { RenameJobLog, LibrarySnapshot } from './types.ts';
import { logRenameRun, logRenameError } from './logger.ts';
import { notifications } from '$lib/server/notifications/definitions/index.ts';
import { notificationServicesQueries } from '$db/queries/notificationServices.ts';
import { logger } from '$logger/logger.ts';

import {
	createLog,
	getItemsNeedingFileRename,
	processDryRun,
	processFileRename,
	processFolderRename,
	diffSnapshots
} from './core.ts';
import type { RenameAdapter } from './core.ts';

// Re-export core types/functions for consumers
export {
	createLog,
	parseRenamedCount,
	groupByRootFolder,
	getItemsNeedingFileRename,
	processDryRun,
	processFileRename,
	processFolderRename,
	diffSnapshots
} from './core.ts';
export type { RenameAdapter, LibraryItem } from './core.ts';

const SOURCE = 'RenameProcessor';

// =========================================================================
// Command monitoring
// =========================================================================

/**
 * After calling an editor endpoint (movie/editor, series/editor), find the
 * spawned background command (Bulk Move) and wait for it to complete.
 * Looks for any new command with id > maxIdBefore.
 */
async function waitForSpawnedCommand(
	client: {
		getCommands(): Promise<{ id: number; status: string }[]>;
		waitForCommand(id: number): Promise<unknown>;
	},
	maxIdBefore: number,
	label: string
): Promise<void> {
	// Poll for the new command to appear (may take a moment)
	for (let attempt = 0; attempt < 30; attempt++) {
		await new Promise((r) => setTimeout(r, 1000));

		const commands = await client.getCommands();
		const newCmd = commands.find(
			(c) => c.id > maxIdBefore && (c.status === 'queued' || c.status === 'started')
		);

		if (newCmd) {
			await logger.debug(`Found spawned command ${newCmd.id} for ${label}, waiting...`, {
				source: SOURCE,
				meta: { commandId: newCmd.id, status: newCmd.status }
			});
			await client.waitForCommand(newCmd.id);
			return;
		}

		// Check if a new command already completed
		const completed = commands.find((c) => c.id > maxIdBefore && c.status === 'completed');
		if (completed) {
			await logger.debug(`Spawned command ${completed.id} for ${label} already completed`, {
				source: SOURCE,
				meta: { commandId: completed.id }
			});
			return;
		}
	}

	await logger.warn(`No spawned command found for ${label} after 30s, proceeding`, {
		source: SOURCE
	});
}

// =========================================================================
// Adapter factories
// =========================================================================

function createRadarrAdapter(client: RadarrClient): RenameAdapter {
	return {
		async getLibraryItems() {
			const movies = await client.getMovies();
			return movies.map((m) => ({
				id: m.id,
				title: m.title,
				tags: m.tags ?? [],
				rootFolderPath: m.rootFolderPath ?? ''
			}));
		},
		getTags: () => client.getTags(),
		getRenamePreview: (id) => client.getRenamePreview(id),
		renameFiles: (ids) => client.renameMovies(ids),
		async renameFolders(ids, rootFolderPath) {
			const BATCH_SIZE = 50;
			for (let i = 0; i < ids.length; i += BATCH_SIZE) {
				const batch = ids.slice(i, i + BATCH_SIZE);
				const beforeCmds = await client.getCommands();
				const maxId = Math.max(0, ...beforeCmds.map((c) => c.id));

				await client.renameMovieFolders(batch, rootFolderPath);

				await waitForSpawnedCommand(
					client,
					maxId,
					`Radarr folder rename batch ${Math.floor(i / BATCH_SIZE) + 1}`
				);
			}
		},
		waitForCommand: (id) => client.waitForCommand(id),
		async getSnapshot(entityIds) {
			const idSet = new Set(entityIds);
			const movies = await client.getMovies();
			const relevant = movies.filter((m) => idSet.has(m.id));

			const idsWithFiles = relevant.filter((m) => m.hasFile).map((m) => m.id);
			const movieFiles = idsWithFiles.length > 0 ? await client.getMovieFiles(idsWithFiles) : [];
			const fileMap = new Map(movieFiles.map((mf) => [mf.movieId, mf]));

			const snapshot: LibrarySnapshot = new Map();
			for (const movie of relevant) {
				const file = fileMap.get(movie.id);
				snapshot.set(movie.id, {
					id: movie.id,
					title: movie.title,
					folderPath: movie.path ?? '',
					files: file ? [{ id: file.id, relativePath: file.relativePath ?? '' }] : []
				});
			}
			return snapshot;
		}
	};
}

function createSonarrAdapter(client: SonarrClient): RenameAdapter {
	return {
		async getLibraryItems() {
			const series = await client.getAllSeries();
			return series.map((s) => ({
				id: s.id,
				title: s.title,
				tags: s.tags ?? [],
				rootFolderPath: s.rootFolderPath ?? ''
			}));
		},
		getTags: () => client.getTags(),
		getRenamePreview: (id) => client.getRenamePreview(id),
		renameFiles: (ids) => client.renameSeries(ids),
		async renameFolders(ids, rootFolderPath) {
			const BATCH_SIZE = 10;
			for (let i = 0; i < ids.length; i += BATCH_SIZE) {
				const batch = ids.slice(i, i + BATCH_SIZE);
				const beforeCmds = await client.getCommands();
				const maxId = Math.max(0, ...beforeCmds.map((c) => c.id));

				await client.renameSeriesFolders(batch, rootFolderPath);

				await waitForSpawnedCommand(
					client,
					maxId,
					`Sonarr folder rename batch ${Math.floor(i / BATCH_SIZE) + 1}`
				);
			}
		},
		waitForCommand: (id) => client.waitForCommand(id),
		async getSnapshot(entityIds) {
			const idSet = new Set(entityIds);
			const allSeries = await client.getAllSeries();
			const relevant = allSeries.filter((s) => idSet.has(s.id));

			const snapshot: LibrarySnapshot = new Map();
			const CONCURRENCY = 10;

			for (let i = 0; i < relevant.length; i += CONCURRENCY) {
				const batch = relevant.slice(i, i + CONCURRENCY);
				const results = await Promise.all(
					batch.map(async (s) => ({
						series: s,
						files: await client.getEpisodeFiles(s.id)
					}))
				);
				for (const { series, files } of results) {
					snapshot.set(series.id, {
						id: series.id,
						title: series.title,
						folderPath: series.path ?? '',
						files: files.map((f) => ({ id: f.id, relativePath: f.relativePath ?? '' }))
					});
				}
			}
			return snapshot;
		}
	};
}

// =========================================================================
// Notification
// =========================================================================

async function sendRenameNotification(
	log: RenameJobLog,
	summaryNotifications: boolean
): Promise<void> {
	const { DiscordNotifier } = await import('$lib/server/notifications/notifiers/discord/index.ts');

	const services = notificationServicesQueries.getAllEnabled();
	const notificationType = `rename.${log.status}`;

	for (const service of services) {
		try {
			const enabledTypes = JSON.parse(service.enabled_types) as string[];
			if (!enabledTypes.includes(notificationType)) {
				continue;
			}

			const config = JSON.parse(service.config);

			if (service.service_type === 'discord') {
				const notifier = new DiscordNotifier(config);
				const notification = notifications.rename({ log, config, summaryNotifications }).build();
				await notifier.notify(notification);
			}
		} catch {
			// Errors are logged by the notifier
		}
	}
}

// =========================================================================
// Main entry point
// =========================================================================

/**
 * Restart safety: if Profilarr shuts down mid-rename, the job queue recovers
 * the running job back to 'queued' on startup (see jobs/init.ts recoverRunning).
 * The job re-runs from scratch, but this is safe because:
 *  - File renames: the preview filter sees already-renamed files as correct and skips them
 *  - Folder renames: the arr editor endpoint is a no-op if folders are already named correctly
 *  - Snapshots/diffs: only capture actual changes, so no phantom results
 * The only cost is re-running preview checks and snapshots (lightweight GETs).
 */
export async function processRenameConfig(
	settings: RenameSettings,
	instance: ArrInstance,
	manual: boolean = false,
	dryRun: boolean = false
): Promise<RenameJobLog> {
	const log = createLog(instance, settings, manual, dryRun);

	try {
		// Create client and adapter
		const client = createArrClient(
			instance.type as 'radarr' | 'sonarr',
			instance.url,
			instance.api_key
		);

		let adapter: RenameAdapter;
		if (instance.type === 'radarr') {
			adapter = createRadarrAdapter(client as RadarrClient);
		} else {
			adapter = createSonarrAdapter(client as SonarrClient);
		}

		// Fetch library + tags
		const fetchStart = Date.now();
		const [items, tags] = await Promise.all([adapter.getLibraryItems(), adapter.getTags()]);
		log.library.fetchDurationMs = Date.now() - fetchStart;
		log.library.totalItems = items.length;

		await logger.debug(
			`Fetched library: ${items.length} items in ${log.library.fetchDurationMs}ms`,
			{
				source: SOURCE,
				meta: {
					instanceId: instance.id,
					totalItems: items.length,
					fetchDurationMs: log.library.fetchDurationMs
				}
			}
		);

		// Filter by ignore tag
		let filteredItems = items;
		if (settings.ignoreTag) {
			const tag = tags.find((t) => t.label.toLowerCase() === settings.ignoreTag!.toLowerCase());
			if (tag) {
				filteredItems = items.filter((item) => !item.tags.includes(tag.id));
				log.filtering.skippedByTag = items.length - filteredItems.length;
			}

			await logger.debug(
				`Filtered by tag "${settings.ignoreTag}": ${filteredItems.length} remaining, ${log.filtering.skippedByTag} skipped`,
				{
					source: SOURCE,
					meta: {
						instanceId: instance.id,
						ignoreTag: settings.ignoreTag,
						remaining: filteredItems.length,
						skipped: log.filtering.skippedByTag
					}
				}
			);
		}
		log.filtering.afterIgnoreTag = filteredItems.length;

		// Early exit if nothing to process
		if (filteredItems.length === 0) {
			log.status = 'skipped';
			log.completedAt = new Date().toISOString();
			await logRenameRun(log);
			return log;
		}

		// Process
		if (dryRun) {
			await logger.debug(`Checking rename previews for ${filteredItems.length} items`, {
				source: SOURCE,
				meta: { instanceId: instance.id, itemCount: filteredItems.length }
			});

			await processDryRun(adapter, filteredItems, log);

			await logger.debug(
				`Dry run complete: ${log.results.filesNeedingRename} files need renaming across ${log.renamedItems.length} items`,
				{
					source: SOURCE,
					meta: {
						instanceId: instance.id,
						filesNeedingRename: log.results.filesNeedingRename,
						itemsWithRenames: log.renamedItems.length
					}
				}
			);
		} else {
			const filteredIds = filteredItems.map((i) => i.id);
			const batchSize = instance.type === 'sonarr' ? 10 : 50;

			// Step 1: Preview-filter to find items that actually need file renames
			const itemsNeedingRename = await getItemsNeedingFileRename(adapter, filteredItems, log);

			await logger.debug(
				`Preview filter: ${itemsNeedingRename.length}/${filteredItems.length} items need file renames`,
				{
					source: SOURCE,
					meta: {
						instanceId: instance.id,
						needingRename: itemsNeedingRename.length,
						total: filteredItems.length
					}
				}
			);

			// Step 2: Snapshot before (all items — folders still need full diff)
			const beforeSnapshot = await adapter.getSnapshot(filteredIds);

			// Step 3: File rename (only items that need it)
			if (itemsNeedingRename.length > 0) {
				await processFileRename(adapter, itemsNeedingRename, log, batchSize);
			}

			// Step 4: Folder rename (if enabled) — no preview available, uses all items
			if (settings.renameFolders) {
				await processFolderRename(adapter, filteredItems, log);
			}

			// Step 5: Snapshot after (all commands completed)
			const afterSnapshot = await adapter.getSnapshot(filteredIds);

			// Step 5: Diff snapshots to find actual changes
			const diff = diffSnapshots(beforeSnapshot, afterSnapshot);

			let totalFilesRenamed = 0;
			let totalFoldersRenamed = 0;

			for (const entity of diff) {
				totalFilesRenamed += entity.files.length;
				if (entity.folder) totalFoldersRenamed++;

				log.renamedItems.push({
					id: entity.id,
					title: entity.title,
					folder: entity.folder
						? { existingPath: entity.folder.oldPath, newPath: entity.folder.newPath }
						: undefined,
					files: entity.files.map((f) => ({
						existingPath: f.oldPath,
						newPath: f.newPath
					}))
				});
			}

			// Override counts with actual diff results
			log.results.filesRenamed = totalFilesRenamed;
			log.results.filesNeedingRename = totalFilesRenamed;
			log.results.foldersRenamed = totalFoldersRenamed;

			await logger.debug(
				`Diff: ${totalFilesRenamed} files, ${totalFoldersRenamed} folders across ${diff.length} entities`,
				{
					source: SOURCE,
					meta: {
						instanceId: instance.id,
						filesRenamed: totalFilesRenamed,
						foldersRenamed: totalFoldersRenamed,
						entitiesChanged: diff.length
					}
				}
			);
		}

		// Determine final status
		if (log.results.errors.length > 0) {
			log.status =
				log.results.filesRenamed > 0 || log.results.foldersRenamed > 0 ? 'partial' : 'failed';

			for (const error of log.results.errors) {
				await logger.warn(`Rename error: ${error}`, {
					source: SOURCE,
					meta: { instanceId: instance.id, status: log.status }
				});
			}
		}

		log.completedAt = new Date().toISOString();

		// Log and persist
		await logRenameRun(log);

		// Send notification (not for dry runs)
		if (!dryRun) {
			try {
				await sendRenameNotification(log, settings.summaryNotifications);
			} catch (err) {
				await logger.error('Failed to send rename notification', {
					source: SOURCE,
					meta: { error: err }
				});
			}
		}
	} catch (err) {
		log.status = 'failed';
		log.completedAt = new Date().toISOString();
		log.results.errors.push(err instanceof Error ? err.message : String(err));

		await logRenameError(instance.id, instance.name, String(err));
		await logRenameRun(log);
	}

	return log;
}
