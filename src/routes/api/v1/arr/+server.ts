import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '#api/v1.d.ts';
import { arrInstancesQueries, toPublicArrInstance } from '#db/queries/arrInstances.ts';
import { createArrInstance } from '#server/arr_instances/service.ts';

type ArrInstance = components['schemas']['ArrInstance'];
type ErrorResponse = components['schemas']['ErrorResponse'];

export const GET: RequestHandler = async () => {
	const instances = arrInstancesQueries.getAll().map(toPublicArrInstance) as ArrInstance[];
	return Response.json(instances);
};

export const POST: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: 'Invalid JSON body' } satisfies ErrorResponse, { status: 400 });
	}

	const result = await createArrInstance(body);
	if (!result.ok) {
		return Response.json({ error: result.message } satisfies ErrorResponse, {
			status: result.kind === 'failed' ? 500 : 400
		});
	}

	return Response.json(toPublicArrInstance(result.instance) as ArrInstance, { status: 201 });
};
