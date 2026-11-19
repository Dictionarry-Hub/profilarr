import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '#api/v1.d.ts';
import { toPublicArrInstance } from '#db/queries/arrInstances.ts';
import { deleteArrInstance, updateArrInstance } from '#server/arr_instances/service.ts';

type ArrInstance = components['schemas']['ArrInstance'];
type ErrorResponse = components['schemas']['ErrorResponse'];

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = parseInt(params.id || '', 10);
	if (isNaN(id)) {
		return Response.json({ error: 'Invalid instance ID' } satisfies ErrorResponse, { status: 400 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: 'Invalid JSON body' } satisfies ErrorResponse, { status: 400 });
	}

	const result = await updateArrInstance(id, body);
	if (!result.ok) {
		const status = result.kind === 'not_found' ? 404 : result.kind === 'failed' ? 500 : 400;
		return Response.json({ error: result.message } satisfies ErrorResponse, { status });
	}

	return Response.json(toPublicArrInstance(result.instance) as ArrInstance);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id || '', 10);
	if (isNaN(id)) {
		return Response.json({ error: 'Invalid instance ID' } satisfies ErrorResponse, { status: 400 });
	}

	const result = await deleteArrInstance(id);
	if (!result.ok) {
		const status = result.kind === 'not_found' ? 404 : 500;
		return Response.json({ error: result.message } satisfies ErrorResponse, { status });
	}

	return new Response(null, { status: 204 });
};
