import { pcdOpsQueries } from '$db/queries/pcdOps.ts';
import { pcdOpHistoryQueries } from '$db/queries/pcdOpHistory.ts';
import { compile } from '$pcd/index.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { uuid } from '$shared/utils/uuid.ts';
import { logger } from '$logger/logger.ts';
import type { PcdOp } from '$db/queries/pcdOps.ts';

export type AlignConflictResult = {
	success: boolean;
	error?: string;
};

type OpMetadata = {
	group_id?: string;
};

function getGroupId(op: PcdOp): string | null {
	if (!op.metadata) return null;
	try {
		const parsed = JSON.parse(op.metadata) as OpMetadata;
		return typeof parsed.group_id === 'string' ? parsed.group_id : null;
	} catch {
		return null;
	}
}

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

	const groupId = getGroupId(op);
	let opsToDrop: PcdOp[] = [op];

	if (groupId) {
		const candidates = pcdOpsQueries.listByDatabaseAndOrigin(databaseId, 'user', {
			states: ['published']
		});
		const grouped = candidates.filter((candidate) => getGroupId(candidate) === groupId);
		if (grouped.length > 0) {
			opsToDrop = grouped;
		}
	}

	const batchId = uuid();

	for (const dropOp of opsToDrop) {
		const updated = pcdOpsQueries.update(dropOp.id, { state: 'dropped' });
		if (!updated) {
			return { success: false, error: 'Failed to drop conflicting operation' };
		}

		pcdOpHistoryQueries.create({
			opId: dropOp.id,
			databaseId,
			batchId,
			status: 'dropped'
		});
	}

	const instance = databaseInstancesQueries.getById(databaseId);
	if (instance?.enabled) {
		await compile(instance.local_path, databaseId);
	}

	await logger.info('Aligned conflict', {
		source: 'PCDConflicts',
		meta: {
			databaseId,
			opId,
			groupId: groupId ?? undefined,
			droppedOpIds: opsToDrop.map((dropOp) => dropOp.id)
		}
	});

	return { success: true };
}
