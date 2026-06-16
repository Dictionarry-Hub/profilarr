import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { ConflictError } from '$pcd/core/errors.ts';
import { ENTITY_TYPES } from '$shared/pcd/portable.ts';
import type { EntityType } from '$shared/pcd/portable.ts';
import { cloneEntityAcross } from '$pcd/entities/cloneAcross.ts';

interface ErrorResponse {
	error: string;
}

const VALID_ENTITY_TYPES: ReadonlySet<string> = new Set(ENTITY_TYPES);

export const POST: RequestHandler = async ({ params, request }) => {
	const sourceDatabaseId = parseInt(params.id ?? '', 10);
	const targetDatabaseId = parseInt(params.targetId ?? '', 10);

	if (isNaN(sourceDatabaseId)) {
		return json({ error: 'Invalid source database ID' } satisfies ErrorResponse, { status: 400 });
	}
	if (isNaN(targetDatabaseId)) {
		return json({ error: 'Invalid target database ID' } satisfies ErrorResponse, { status: 400 });
	}

	if (sourceDatabaseId === targetDatabaseId) {
		return json(
			{ error: 'Source and target databases must be different' } satisfies ErrorResponse,
			{ status: 400 }
		);
	}

	const sourceDb = pcdManager.getByIdPublic(sourceDatabaseId);
	const targetDb = pcdManager.getByIdPublic(targetDatabaseId);
	if (!sourceDb) {
		return json({ error: 'Source database not found' } satisfies ErrorResponse, { status: 404 });
	}
	if (!targetDb) {
		return json({ error: 'Target database not found' } satisfies ErrorResponse, { status: 404 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' } satisfies ErrorResponse, { status: 400 });
	}

	const { entityType, name, newName } = body;

	if (!entityType || !name) {
		return json({ error: 'Missing required fields: entityType, name' } satisfies ErrorResponse, {
			status: 400
		});
	}

	if (!VALID_ENTITY_TYPES.has(entityType as string)) {
		return json({ error: `Invalid entityType: ${entityType}` } satisfies ErrorResponse, {
			status: 400
		});
	}

	try {
		const result = await cloneEntityAcross({
			sourceDatabaseId,
			targetDatabaseId,
			entityType: entityType as EntityType,
			sourceName: name as string,
			newName: (newName as string) || undefined
		});

		return json({ success: true, data: result });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Clone failed';
		const status = err instanceof ConflictError ? 409 : 400;
		return json({ error: message } satisfies ErrorResponse, { status });
	}
};
