import { pcdOpsQueries } from '$db/queries/pcdOps.ts';
import { pcdOpHistoryQueries } from '$db/queries/pcdOpHistory.ts';
import { compile } from '$pcd/index.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { uuid } from '$shared/utils/uuid.ts';
import { logger } from '$logger/logger.ts';

export type AlignConflictResult = {
	success: boolean;
	error?: string;
};

export async function alignConflict(input: {
	databaseId: number;
	opId: number;
}): Promise<AlignConflictResult> {
	const { databaseId, opId } = input;

	const op = pcdOpsQueries.getById(opId);
	if (!op || op.database_id !== databaseId) {
		return { success: false, error: 'Conflict operation not found' };
	}

	if (op.origin !== 'user' || op.state !== 'published') {
		return { success: false, error: 'Only published user operations can be aligned' };
	}

	const updated = pcdOpsQueries.update(opId, { state: 'dropped' });
	if (!updated) {
		return { success: false, error: 'Failed to drop conflicting operation' };
	}

	pcdOpHistoryQueries.create({
		opId,
		databaseId,
		batchId: uuid(),
		status: 'dropped'
	});

	const instance = databaseInstancesQueries.getById(databaseId);
	if (instance?.enabled) {
		await compile(instance.local_path, databaseId);
	}

	await logger.info('Aligned conflict', {
		source: 'PCDConflicts',
		meta: { databaseId, opId }
	});

	return { success: true };
}
