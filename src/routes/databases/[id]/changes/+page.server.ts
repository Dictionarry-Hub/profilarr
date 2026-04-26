import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { pcdOpsQueries } from '$db/queries/pcdOps.ts';
import { pcdOpHistoryQueries } from '$db/queries/pcdOpHistory.ts';
import { logger } from '$logger/logger.ts';
import { pcdManager } from '$pcd/core/manager.ts';
import { reconcileAndNotify, reconcileFromWorkingCopy } from '$announcements/database/index.ts';
import { compile } from '$pcd/database/compiler.ts';
import { listDraftEntityChanges } from '$pcd/ops/draftChanges.ts';
import { exportDraftOps, previewDraftOps } from '$pcd/ops/exporter.ts';
import { uuid } from '$shared/utils/uuid.ts';
import { validateFilePaths } from '$utils/paths.ts';
import { getStatus, restorePathsToHead } from '$utils/git/index.ts';

export const load: PageServerLoad = async ({ parent }) => {
	const { database } = await parent();

	return {
		isDeveloper: database.hasPat
	};
};

export const actions: Actions = {
	drop: async ({ request, params }) => {
		const id = parseInt(params.id || '', 10);
		const database = databaseInstancesQueries.getById(id);

		if (!database) {
			return { success: false, error: 'Database not found' };
		}

		try {
			const formData = await request.formData();
			const opIdsInput = (formData.getAll('opIds') as string[])
				.map((value) => Number(value))
				.filter((value) => Number.isFinite(value));
			const filePathsInput = (formData.getAll('filePaths') as string[]).filter(Boolean);

			const opIds = new Set<number>();
			const filePaths = new Set<string>();

			if (opIdsInput.length > 0 || filePathsInput.length > 0) {
				for (const opId of opIdsInput) {
					opIds.add(opId);
				}
				for (const filepath of filePathsInput) {
					filePaths.add(filepath);
				}
			} else {
				const keys = (formData.getAll('keys') as string[]).filter(Boolean);

				if (keys.length === 0) {
					return { success: false, error: 'No changes selected' };
				}

				const changes = listDraftEntityChanges(id);
				const changeByKey = new Map(changes.map((change) => [change.key, change]));
				const groupMap = new Map<string, string[]>();

				for (const change of changes) {
					if (!change.groupId) continue;
					const entries = groupMap.get(change.groupId) ?? [];
					entries.push(change.key);
					groupMap.set(change.groupId, entries);
				}

				const keysToDrop = new Set<string>();

				for (const key of keys) {
					const change = changeByKey.get(key);
					if (!change) continue;
					if (change.groupId && groupMap.has(change.groupId)) {
						for (const groupKey of groupMap.get(change.groupId) ?? []) {
							keysToDrop.add(groupKey);
						}
					} else {
						keysToDrop.add(change.key);
					}
				}

				for (const key of keysToDrop) {
					const change = changeByKey.get(key);
					if (!change) continue;
					for (const op of change.ops) {
						opIds.add(op.id);
					}
					if (change.path) {
						filePaths.add(change.path);
					}
				}
			}

			if (opIds.size === 0 && filePaths.size === 0) {
				await logger.warn('Drop requested with no targets', {
					source: 'changes',
					meta: { databaseId: id }
				});
				return { success: false, error: 'No changes selected' };
			}

			// ─── File-backed drops ──────────────────────────────────────────
			let droppedFiles = 0;
			let touchedAnnouncementFiles = false;

			if (filePaths.size > 0) {
				const filePathsArray = Array.from(filePaths);
				try {
					validateFilePaths(database.local_path, filePathsArray);
				} catch {
					return fail(400, { error: 'Invalid file path' });
				}

				// Bucket each requested path against the current working tree.
				const status = await getStatus(database.local_path);
				const untrackedSet = new Set(status.untracked);
				const modifiedSet = new Set(status.modified);
				const deletedSet = new Set(status.deleted);

				const toDelete: string[] = [];
				const toRestore: string[] = [];

				for (const filepath of filePathsArray) {
					if (untrackedSet.has(filepath)) {
						toDelete.push(filepath);
					} else if (modifiedSet.has(filepath) || deletedSet.has(filepath)) {
						toRestore.push(filepath);
					}
					// Files that aren't in any bucket are clean -- nothing to drop.
					if (filepath.startsWith('announcements/') && filepath.endsWith('.md')) {
						touchedAnnouncementFiles = true;
					}
				}

				for (const filepath of toDelete) {
					try {
						await Deno.remove(`${database.local_path}/${filepath}`);
						droppedFiles += 1;
					} catch (err) {
						if (!(err instanceof Deno.errors.NotFound)) throw err;
					}
				}

				if (toRestore.length > 0) {
					await restorePathsToHead(database.local_path, toRestore);
					droppedFiles += toRestore.length;
				}

				if (touchedAnnouncementFiles) {
					try {
						await reconcileFromWorkingCopy(id, { isFirstSync: false });
					} catch (err) {
						await logger.error('Failed to reconcile announcements after drop', {
							source: 'changes',
							meta: { databaseId: id, error: String(err) }
						});
					}
				}
			}

			// ─── Op drops ───────────────────────────────────────────────────
			const batchId = uuid();
			let droppedOps = 0;
			for (const opId of opIds) {
				const op = pcdOpsQueries.getById(opId);
				if (!op || op.database_id !== id || op.state !== 'draft') continue;
				const updated = pcdOpsQueries.update(opId, { state: 'dropped' });
				if (!updated) continue;
				pcdOpHistoryQueries.create({
					opId,
					databaseId: id,
					batchId,
					status: 'dropped'
				});
				droppedOps += 1;
			}

			if (droppedOps === 0 && droppedFiles === 0) {
				await logger.warn('Drop requested but nothing matched', {
					source: 'changes',
					meta: { databaseId: id, requestedOps: opIds.size, requestedFiles: filePaths.size }
				});
				return { success: false, error: 'No changes to drop' };
			}

			if (droppedOps > 0 && database.enabled) {
				try {
					await compile(database.local_path, id);
				} catch (err) {
					await logger.error('Failed to recompile cache after drop', {
						source: 'changes',
						meta: { databaseId: id, error: String(err) }
					});
				}
			}

			await logger.info('Dropped draft changes', {
				source: 'changes',
				meta: {
					databaseId: id,
					databaseName: database.name,
					batchId,
					requestedOps: opIds.size,
					droppedOps,
					requestedFiles: filePaths.size,
					droppedFiles,
					opIds: Array.from(opIds),
					filePaths: Array.from(filePaths)
				}
			});
			return { success: true, dropped: droppedOps + droppedFiles };
		} catch (err) {
			await logger.error('Failed to drop changes', {
				source: 'changes',
				meta: { databaseId: id, error: String(err) }
			});
			return {
				success: false,
				error: err instanceof Error ? err.message : 'Failed to drop changes'
			};
		}
	},
	commit: async ({ request, params }) => {
		const id = parseInt(params.id || '', 10);
		const database = databaseInstancesQueries.getById(id);

		if (!database) {
			return { success: false, error: 'Database not found' };
		}

		const formData = await request.formData();
		const opIds = (formData.getAll('opIds') as string[])
			.map((value) => Number(value))
			.filter((value) => Number.isFinite(value));
		const filePaths = (formData.getAll('filePaths') as string[]).filter(Boolean);
		const message = (formData.get('message') as string) ?? '';
		const exportedAt = formData.get('exportedAt')?.toString().trim() || null;

		if (filePaths.length > 0) {
			try {
				validateFilePaths(database.local_path, filePaths);
			} catch {
				return fail(400, { error: 'Invalid file path' });
			}
		}

		if (opIds.length === 0 && filePaths.length === 0) {
			return { success: false, error: 'No changes selected' };
		}
		if (!message.trim()) {
			return fail(400, { error: 'Commit message is required' });
		}

		const result = await exportDraftOps(id, opIds, message, exportedAt, filePaths);
		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to export changes' });
		}

		return {
			success: true,
			filename: result.filename,
			opId: result.opId,
			dropped: result.dropped,
			fileCount: result.fileCount
		};
	},
	preview: async ({ request, params }) => {
		const id = parseInt(params.id || '', 10);
		const database = databaseInstancesQueries.getById(id);

		if (!database) {
			return { success: false, error: 'Database not found' };
		}

		const formData = await request.formData();
		const opIds = (formData.getAll('opIds') as string[])
			.map((value) => Number(value))
			.filter((value) => Number.isFinite(value));
		const filePaths = (formData.getAll('filePaths') as string[]).filter(Boolean);
		const message = (formData.get('message') as string) ?? '';

		if (filePaths.length > 0) {
			try {
				validateFilePaths(database.local_path, filePaths);
			} catch {
				return fail(400, { error: 'Invalid file path' });
			}
		}

		if (opIds.length === 0 && filePaths.length === 0) {
			return { success: false, error: 'No changes selected' };
		}
		if (!message.trim()) {
			return fail(400, { error: 'Commit message is required' });
		}

		const result = await previewDraftOps(id, opIds, message, filePaths);
		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to preview export' });
		}

		return {
			success: true,
			preview: result.preview
		};
	},
	pull: async ({ params }) => {
		const id = parseInt(params.id || '', 10);
		const database = databaseInstancesQueries.getById(id);

		if (!database) {
			return { success: false, error: 'Database not found' };
		}

		// Capture before pcdManager.sync, which updates last_synced_at as
		// part of its work. Used by the announcements reconciler to choose
		// between silent insert (new link with backlog) and normal
		// notification firing.
		const isFirstSync = database.last_synced_at === null;

		try {
			const result = await pcdManager.sync(id, 'manual-ui');
			if (result.success) {
				await reconcileAndNotify(id, { source: 'changes', isFirstSync });
			}
			return result;
		} catch (err) {
			await logger.error('Failed to pull changes', {
				source: 'changes',
				meta: { databaseId: id, error: String(err) }
			});
			return {
				success: false,
				error: err instanceof Error ? err.message : 'Failed to pull'
			};
		}
	}
};
