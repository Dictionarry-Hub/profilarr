import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getBundledOpenApiSpec } from '$utils/openapi/spec.ts';

export const GET: RequestHandler = async () => {
	return json(await getBundledOpenApiSpec());
};
