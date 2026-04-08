import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1';
import { pcdManager } from '$pcd/core/manager.ts';
import { validateLinkInput, checkNameConflict } from '$pcd/core/validate.ts';
import { schedulePcdSyncForDatabase } from '$lib/server/jobs/init.ts';
import { logger } from '$logger/logger.ts';

type DatabaseInstance = components['schemas']['DatabaseInstance'];
type ErrorResponse = components['schemas']['ErrorResponse'];

export const GET: RequestHandler = async () => {
	const databases: DatabaseInstance[] = pcdManager
		.getAllPublic()
		.map(({ local_path, ...rest }) => rest);
	return json(databases);
};

export const POST: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' } satisfies ErrorResponse, { status: 400 });
	}

	const result = validateLinkInput(body);
	if (!result.ok) {
		return json({ error: result.error } satisfies ErrorResponse, { status: 400 });
	}

	const { input } = result;

	if (checkNameConflict(input.name)) {
		return json({ error: 'A database with this name already exists' } satisfies ErrorResponse, {
			status: 409
		});
	}

	try {
		const instance = await pcdManager.link(input);
		schedulePcdSyncForDatabase(instance.id);

		const { personal_access_token, local_path, ...safe } = instance;
		const response: DatabaseInstance = {
			...safe,
			hasPat: personal_access_token !== null
		};
		return json(response, { status: 201 });
	} catch (error) {
		await logger.error('Failed to link database', {
			source: 'POST /api/v1/databases',
			meta: {
				error: error instanceof Error ? error.message : String(error),
				name: input.name,
				repositoryUrl: input.repositoryUrl
			}
		});

		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to link database'
			} satisfies ErrorResponse,
			{ status: 422 }
		);
	}
};
