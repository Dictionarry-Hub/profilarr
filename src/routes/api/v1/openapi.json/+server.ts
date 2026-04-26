import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import openApiSpec from '$api/v1.openapi.json' with { type: 'json' };

export const GET: RequestHandler = async () => {
	return json(openApiSpec);
};
