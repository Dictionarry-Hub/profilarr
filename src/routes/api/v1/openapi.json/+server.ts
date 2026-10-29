import type { RequestHandler } from '@sveltejs/kit';
import openApiSpec from '#api/v1.openapi.json' with { type: 'json' };

export const GET: RequestHandler = async () => {
	return Response.json(openApiSpec);
};
