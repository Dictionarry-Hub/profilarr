import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '#api/v1.d.ts';
import { databaseInstancesQueries } from '#db/queries/databaseInstances.ts';
import { enqueueJob } from '#server/jobs/queueService.ts';

type SyncTriggerResponse = components['schemas']['SyncTriggerResponse'];
type ErrorResponse = components['schemas']['ErrorResponse'];

export const POST: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id || '', 10);
	if (!Number.isFinite(id)) {
		return Response.json({ error: 'Invalid database ID' } satisfies ErrorResponse, { status: 400 });
	}

	const instance = databaseInstancesQueries.getById(id);
	if (!instance) {
		return Response.json({ error: 'Database not found' } satisfies ErrorResponse, { status: 404 });
	}

	if (instance.enabled === 0) {
		return Response.json({ error: 'Database is disabled' } satisfies ErrorResponse, {
			status: 400
		});
	}

	const queued = enqueueJob({
		jobType: 'pcd.sync',
		runAt: new Date().toISOString(),
		payload: { databaseId: id },
		source: 'manual'
	});

	const response: SyncTriggerResponse = { jobId: queued.id };
	return Response.json(response, { status: 202 });
};
