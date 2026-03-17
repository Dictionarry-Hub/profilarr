/**
 * Pure rename processing logic — no DB, logger, or notification imports.
 * Extracted so tests can import without triggering SQLite initialization.
 *
 * The main processor (processor.ts) imports and re-exports from here.
 */

import type { ArrCommand, ArrTag, RenamePreviewItem } from '$lib/server/utils/arr/types.ts';
import type { RenameSettings } from '$db/queries/arrRenameSettings.ts';
import type { ArrInstance } from '$db/queries/arrInstances.ts';
import type { RenameJobLog, LibrarySnapshot } from './types.ts';

// =========================================================================
// Adapter types
// =========================================================================

export interface LibraryItem {
	id: number;
	title: string;
	tags: number[];
	rootFolderPath: string;
	imageUrl?: string;
}

export interface RenameAdapter {
	getLibraryItems(): Promise<LibraryItem[]>;
	getTags(): Promise<ArrTag[]>;
	getRenamePreview(id: number): Promise<RenamePreviewItem[]>;
	renameFiles(ids: number[]): Promise<ArrCommand>;
	renameFolders(ids: number[], rootFolderPath: string): Promise<void>;
	waitForCommand(commandId: number): Promise<ArrCommand>;
	getSnapshot(entityIds: number[]): Promise<LibrarySnapshot>;
}

// =========================================================================
// Helpers
// =========================================================================

/** Parse renamed file count from command message like "6 episode files renamed for ..." */
export function parseRenamedCount(message?: string): number {
	if (!message) return 0;
	const match = message.match(/^(\d+)/);
	return match ? parseInt(match[1], 10) : 0;
}

/** Group items by their rootFolderPath */
export function groupByRootFolder(items: LibraryItem[]): Map<string, number[]> {
	const groups = new Map<string, number[]>();
	for (const item of items) {
		const existing = groups.get(item.rootFolderPath);
		if (existing) {
			existing.push(item.id);
		} else {
			groups.set(item.rootFolderPath, [item.id]);
		}
	}
	return groups;
}

/** Create an empty log shell */
export function createLog(
	instance: ArrInstance,
	settings: RenameSettings,
	manual: boolean,
	dryRun: boolean
): RenameJobLog {
	return {
		id: crypto.randomUUID(),
		instanceId: instance.id,
		instanceName: instance.name,
		instanceType: instance.type as 'radarr' | 'sonarr',
		startedAt: new Date().toISOString(),
		completedAt: '',
		status: 'success',
		config: {
			dryRun,
			renameFolders: settings.renameFolders,
			ignoreTag: settings.ignoreTag,
			manual
		},
		library: {
			totalItems: 0,
			fetchDurationMs: 0
		},
		filtering: {
			afterIgnoreTag: 0,
			skippedByTag: 0
		},
		results: {
			filesNeedingRename: 0,
			filesRenamed: 0,
			foldersRenamed: 0,
			commandsTriggered: 0,
			commandsCompleted: 0,
			commandsFailed: 0,
			errors: []
		},
		renamedItems: []
	};
}

// =========================================================================
// Dry run — uses preview endpoint to show what would change
// =========================================================================

export async function processDryRun(
	adapter: RenameAdapter,
	items: LibraryItem[],
	log: RenameJobLog
): Promise<void> {
	for (const item of items) {
		try {
			const previews = await adapter.getRenamePreview(item.id);
			if (previews.length > 0) {
				log.results.filesNeedingRename += previews.length;
				log.renamedItems.push({
					id: item.id,
					title: item.title,
					files: previews.map((p) => ({
						existingPath: p.existingPath,
						newPath: p.newPath
					})),
					imageUrl: item.imageUrl
				});
			}
		} catch (err) {
			log.results.errors.push(
				`Preview failed for "${item.title}": ${err instanceof Error ? err.message : String(err)}`
			);
		}
	}
}

// =========================================================================
// Live run — individual steps
// =========================================================================

/**
 * Pre-filter items by checking rename previews before sending to the rename command.
 * Only applies to file renames — there is no "folder rename preview" endpoint in the
 * Radarr/Sonarr API. Folder renames rely on batching alone to avoid DB locks.
 */
export async function getItemsNeedingFileRename(
	adapter: RenameAdapter,
	items: LibraryItem[],
	log: RenameJobLog
): Promise<LibraryItem[]> {
	const CONCURRENCY = 10;
	const needsRename: LibraryItem[] = [];

	for (let i = 0; i < items.length; i += CONCURRENCY) {
		const batch = items.slice(i, i + CONCURRENCY);
		const results = await Promise.all(
			batch.map(async (item) => {
				try {
					const previews = await adapter.getRenamePreview(item.id);
					return { item, count: previews.length };
				} catch {
					return { item, count: 0 };
				}
			})
		);
		for (const { item, count } of results) {
			if (count > 0) {
				log.results.filesNeedingRename += count;
				needsRename.push(item);
			}
		}
	}

	return needsRename;
}

/** Send rename files command and wait for completion, batched to avoid DB locks */
export async function processFileRename(
	adapter: RenameAdapter,
	items: LibraryItem[],
	log: RenameJobLog,
	batchSize: number = 50
): Promise<void> {
	const ids = items.map((i) => i.id);

	for (let i = 0; i < ids.length; i += batchSize) {
		const batch = ids.slice(i, i + batchSize);
		try {
			const command = await adapter.renameFiles(batch);
			log.results.commandsTriggered++;

			const result = await adapter.waitForCommand(command.id);
			log.results.commandsCompleted++;

			// Count is now derived from snapshot diff; keep command count for debug sanity check
			log.results.filesRenamed += parseRenamedCount(result.message);
		} catch (err) {
			log.results.commandsFailed++;
			log.results.errors.push(
				`File rename failed (batch ${Math.floor(i / batchSize) + 1}): ${err instanceof Error ? err.message : String(err)}`
			);
			break;
		}
	}
}

// =========================================================================
// Snapshot diffing
// =========================================================================

/** Diff two snapshots to find what actually changed. Returns only entities with changes. */
export function diffSnapshots(
	before: LibrarySnapshot,
	after: LibrarySnapshot
): {
	id: number;
	title: string;
	folder?: { oldPath: string; newPath: string };
	files: { oldPath: string; newPath: string }[];
}[] {
	const result: {
		id: number;
		title: string;
		folder?: { oldPath: string; newPath: string };
		files: { oldPath: string; newPath: string }[];
	}[] = [];

	for (const [id, beforeEntity] of before) {
		const afterEntity = after.get(id);
		if (!afterEntity) continue;

		let folder: { oldPath: string; newPath: string } | undefined;
		if (beforeEntity.folderPath !== afterEntity.folderPath) {
			folder = { oldPath: beforeEntity.folderPath, newPath: afterEntity.folderPath };
		}

		const changedFiles: { oldPath: string; newPath: string }[] = [];
		const afterFileMap = new Map(afterEntity.files.map((f) => [f.id, f]));

		for (const beforeFile of beforeEntity.files) {
			const afterFile = afterFileMap.get(beforeFile.id);
			if (!afterFile) continue;
			if (beforeFile.relativePath !== afterFile.relativePath) {
				changedFiles.push({
					oldPath: beforeFile.relativePath,
					newPath: afterFile.relativePath
				});
			}
		}

		if (folder || changedFiles.length > 0) {
			result.push({ id, title: beforeEntity.title, folder, files: changedFiles });
		}
	}

	return result;
}

// =========================================================================
// Live run — individual steps
// =========================================================================

/** Rename folders grouped by rootFolderPath */
export async function processFolderRename(
	adapter: RenameAdapter,
	items: LibraryItem[],
	log: RenameJobLog
): Promise<void> {
	const groups = groupByRootFolder(items);

	for (const [rootFolderPath, groupIds] of groups) {
		try {
			await adapter.renameFolders(groupIds, rootFolderPath);
			// Folder count is now derived from snapshot diff
			log.results.commandsTriggered++;
			log.results.commandsCompleted++;
		} catch (err) {
			log.results.commandsFailed++;
			log.results.errors.push(
				`Folder rename failed for root "${rootFolderPath}": ${err instanceof Error ? err.message : String(err)}`
			);
		}
	}
}
