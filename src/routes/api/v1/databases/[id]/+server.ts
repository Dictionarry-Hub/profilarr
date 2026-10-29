import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '#api/v1.d.ts';
import { databaseInstancesQueries } from '#db/queries/databaseInstances.ts';
import { pcdManager } from '#pcd/core/manager.ts';
import { validateUpdateInput, checkNameConflict } from '#pcd/core/validate.ts';
import { schedulePcdSyncForDatabase } from '#server/jobs/init.ts';
import { logger } from '#logger/logger.ts';

type DatabaseInstance = components['schemas']['DatabaseInstance'];
type ErrorResponse = components['schemas']['ErrorResponse'];

function parseId(params: Record<string, string>): number | null {
	const id = parseInt(params.id || '', 10);
	return Number.isFinite(id) ? id : null;
}

export const GET: RequestHandler = async ({ params }) => {
	const id = parseId(params);
	if (id === null) {
		return Response.json({ error: 'Invalid database ID' } satisfies ErrorResponse, { status: 400 });
	}

	const instance = pcdManager.getByIdPublic(id);
	if (!instance) {
		return Response.json({ error: 'Database not found' } satisfies ErrorResponse, { status: 404 });
	}

	const { local_path, ...safe } = instance;
	return Response.json(safe satisfies DatabaseInstance);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = parseId(params);
	if (id === null) {
		return Response.json({ error: 'Invalid database ID' } satisfies ErrorResponse, { status: 400 });
	}

	const existing = databaseInstancesQueries.getById(id);
	if (!existing) {
		return Response.json({ error: 'Database not found' } satisfies ErrorResponse, { status: 404 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: 'Invalid JSON body' } satisfies ErrorResponse, { status: 400 });
	}

	const result = validateUpdateInput(body);
	if (!result.ok) {
		return Response.json({ error: result.error } satisfies ErrorResponse, { status: 400 });
	}

	const { input } = result;

	if (input.name && checkNameConflict(input.name, id)) {
		return Response.json(
			{ error: 'A database with this name already exists' } satisfies ErrorResponse,
			{
				status: 409
			}
		);
	}

	try {
		databaseInstancesQueries.update(id, input);
		schedulePcdSyncForDatabase(id);

		const updated = pcdManager.getByIdPublic(id);
		if (!updated) {
			return Response.json({ error: 'Database not found' } satisfies ErrorResponse, {
				status: 404
			});
		}

		const { local_path, ...safe } = updated;
		return Response.json(safe satisfies DatabaseInstance);
	} catch (error) {
		await logger.error('Failed to update database', {
			source: 'PATCH /api/v1/databases/{id}',
			meta: {
				error: error instanceof Error ? error.message : String(error),
				id
			}
		});

		return Response.json(
			{
				error: error instanceof Error ? error.message : 'Failed to update database'
			} satisfies ErrorResponse,
			{ status: 422 }
		);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseId(params);
	if (id === null) {
		return Response.json({ error: 'Invalid database ID' } satisfies ErrorResponse, { status: 400 });
	}

	const existing = databaseInstancesQueries.getById(id);
	if (!existing) {
		return Response.json({ error: 'Database not found' } satisfies ErrorResponse, { status: 404 });
	}

	try {
		await pcdManager.unlink(id);
		return new Response(null, { status: 204 });
	} catch (error) {
		await logger.error('Failed to unlink database', {
			source: 'DELETE /api/v1/databases/{id}',
			meta: {
				error: error instanceof Error ? error.message : String(error),
				id
			}
		});

		return Response.json(
			{
				error: error instanceof Error ? error.message : 'Failed to unlink database'
			} satisfies ErrorResponse,
			{ status: 422 }
		);
	}
};
