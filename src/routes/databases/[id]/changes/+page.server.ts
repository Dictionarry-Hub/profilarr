import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { pcdOpsQueries } from '$db/queries/pcdOps.ts';
import { pcdOpHistoryQueries } from '$db/queries/pcdOpHistory.ts';
import { logger } from '$logger/logger.ts';
import { pcdManager } from '$pcd/core/manager.ts';
import { compile } from '$pcd/database/compiler.ts';
import { listDraftEntityChanges } from '$pcd/ops/draftChanges.ts';
import { exportDraftOps, previewDraftOps } from '$pcd/ops/exporter.ts';
import { uuid } from '$shared/utils/uuid.ts';
import { validateFilePaths } from '$utils/paths.ts';

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

			const opIds = new Set<number>();

			if (opIdsInput.length > 0) {
				for (const opId of opIdsInput) {
					opIds.add(opId);
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
				}
			}

			if (opIds.size === 0) {
				await logger.warn('Drop requested with no operations', {
					source: 'changes',
					meta: { databaseId: id }
				});
				return { success: false, error: 'No operations to drop' };
			}

			const batchId = uuid();
			let droppedCount = 0;
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
				droppedCount += 1;
			}

			if (droppedCount === 0) {
				await logger.warn('Drop requested but no draft ops matched', {
					source: 'changes',
					meta: { databaseId: id, requested: opIds.size }
				});
				return { success: false, error: 'No operations to drop' };
			}

			if (database.enabled) {
				try {
					await compile(database.local_path, id);
				} catch (err) {
					await logger.error('Failed to recompile cache after drop', {
						source: 'changes',
						meta: { databaseId: id, error: String(err) }
					});
				}
			}

			await logger.info('Dropped draft operations', {
				source: 'changes',
				meta: {
					databaseId: id,
					databaseName: database.name,
					batchId,
					requestedOps: opIds.size,
					droppedOps: droppedCount,
					opIds: Array.from(opIds)
				}
			});
			return { success: true, dropped: droppedCount };
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

		try {
			const result = await pcdManager.sync(id);

			if (result.success) {
				await logger.info('Database synced', {
					source: 'changes',
					meta: { databaseId: id, commitsPulled: result.commitsBehind }
				});
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
