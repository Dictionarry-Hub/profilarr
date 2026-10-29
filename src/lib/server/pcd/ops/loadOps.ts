/**
 * PCD Operations Loader (DB-first)
 * Loads base/user ops from the database and schema/tweaks from files.
 */

import { pcdOpsQueries } from '#db/queries/pcdOps.ts';
import type { PcdOp, PcdOpState } from '#db/queries/pcdOps.ts';
import { loadOperationsFromDir } from '#pcd/utils/operations.ts';
import type { Operation } from '#pcd/core/types.ts';

const DRAFT_SEQUENCE_BASE = 3_000_000_000;

function toOperation(op: PcdOp, layer: 'base' | 'user', orderOffset = 0): Operation {
	const order = (op.sequence ?? op.id) + orderOffset;
	const filename = op.filename ?? `pcd_op_${op.id}.sql`;
	return {
		filename,
		filepath: `pcd_ops:${op.id}`,
		sql: op.sql,
		order,
		layer
	};
}

function loadDbOps(
	databaseId: number,
	origin: 'base' | 'user',
	states: PcdOpState[],
	orderOffset = 0
): Operation[] {
	const rows = pcdOpsQueries.listByDatabaseAndOrigin(databaseId, origin, { states });
	const operations = rows.map((op) => toOperation(op, origin, orderOffset));
	return operations.sort((a, b) => a.order - b.order);
}

/**
 * Load all operations for a PCD in layer order:
 * 1. Schema layer (from dependency)
 * 2. Base layer (published, then drafts)
 * 3. Tweaks layer (from PCD, optional)
 * 4. User ops layer (local user modifications)
 */
export async function loadAllOperations(
	pcdPath: string,
	databaseInstanceId: number
): Promise<Operation[]> {
	const allOperations: Operation[] = [];

	// 1. Load schema layer from dependency (files)
	const schemaPath = `${pcdPath}/deps/schema/ops`;
	const schemaOps = await loadOperationsFromDir(schemaPath, 'schema');
	allOperations.push(...schemaOps);

	// 2. Load base layer from DB: published, then drafts
	const basePublished = loadDbOps(databaseInstanceId, 'base', ['published']);
	allOperations.push(...basePublished);
	const baseDrafts = loadDbOps(databaseInstanceId, 'base', ['draft'], DRAFT_SEQUENCE_BASE);
	allOperations.push(...baseDrafts);

	// 3. Load tweaks layer (files, optional)
	const tweaksPath = `${pcdPath}/tweaks`;
	const tweakOps = await loadOperationsFromDir(tweaksPath, 'tweaks');
	allOperations.push(...tweakOps);

	// 4. User ops layer (DB)
	const userOps = loadDbOps(databaseInstanceId, 'user', ['published']);
	allOperations.push(...userOps);

	return allOperations;
}
