/**
 * API key permission enforcement for /api/v1
 *
 * Each v1 operation declares `x-permission: read | write` in the OpenAPI
 * spec, and its single tag is its area. This module reads the bundled spec
 * once and answers "what does this route + method need?". Operations without
 * a label are denied to scoped keys; `all` keys pass everything.
 */

import openApiSpec from '$api/v1.openapi.json' with { type: 'json' };
import { apiAreaId, hasApiAccess, type ApiArea, type ApiKeyAccess } from '$shared/apiKeys.ts';
import type { ResolvedApiKey } from './apiKeyAuth.ts';

interface SpecOperation {
	tags?: string[];
	security?: unknown[];
	'x-permission'?: string;
}

interface Spec {
	tags?: { name: string }[];
	paths: Record<string, Record<string, SpecOperation>>;
}

export interface ApiRequirement {
	area: string;
	access: ApiKeyAccess;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const API_V1_ROUTE_PREFIX = '/api/v1';

/**
 * A path with its parameter names blanked out, so a route folder named
 * `[databaseId]` still matches a spec path using `{id}`. Only the position of
 * a parameter matters, not its name.
 * `/databases/{id}/sync` -> `/databases/{}/sync`
 */
function pathShape(path: string): string {
	return path.replace(/\{[^}]*\}/g, '{}');
}

function buildRequirements(spec: Spec): Map<string, ApiRequirement> {
	const requirements = new Map<string, ApiRequirement>();

	for (const [path, item] of Object.entries(spec.paths)) {
		for (const method of HTTP_METHODS) {
			const operation = item[method];
			if (!operation) continue;

			const access = operation['x-permission'];
			const tags = operation.tags ?? [];
			if ((access !== 'read' && access !== 'write') || tags.length !== 1) continue;

			requirements.set(`${method} ${pathShape(path)}`, { area: apiAreaId(tags[0]), access });
		}
	}

	return requirements;
}

function buildAreas(spec: Spec, requirements: Map<string, ApiRequirement>): ApiArea[] {
	const labelled = [...requirements.values()];

	return (spec.tags ?? [])
		.map((tag) => ({ id: apiAreaId(tag.name), name: tag.name }))
		.filter((area) => labelled.some((r) => r.area === area.id))
		.map((area) => ({
			...area,
			writable: labelled.some((r) => r.area === area.id && r.access === 'write')
		}));
}

const spec = openApiSpec as unknown as Spec;
const requirements = buildRequirements(spec);

/** Areas a key can be granted, in spec tag order */
export const API_AREAS: ApiArea[] = buildAreas(spec, requirements);

/**
 * Convert a SvelteKit route id under /api/v1 to its OpenAPI path template.
 * `/api/v1/databases/[id]/sync` -> `/databases/{id}/sync`
 */
export function routeIdToSpecPath(routeId: string): string | null {
	if (routeId !== API_V1_ROUTE_PREFIX && !routeId.startsWith(`${API_V1_ROUTE_PREFIX}/`)) {
		return null;
	}

	// Route groups like `/(internal)` don't appear in the URL
	const path = routeId.slice(API_V1_ROUTE_PREFIX.length).replace(/\/\([^)]+\)/g, '') || '/';
	// Rest, optional, and matcher params have no OpenAPI equivalent
	if (/\[\.\.\.|\[\[|=/.test(path)) return null;

	return path.replace(/\[([^\]]+)\]/g, '{$1}');
}

/**
 * The permission an /api/v1 route + method needs, or null if the operation
 * has no label.
 */
export function getApiRequirement(routeId: string, method: string): ApiRequirement | null {
	const path = routeIdToSpecPath(routeId);
	if (path === null) return null;

	const normalizedMethod = method.toUpperCase() === 'HEAD' ? 'get' : method.toLowerCase();
	return requirements.get(`${normalizedMethod} ${pathShape(path)}`) ?? null;
}

/**
 * Check a key against a matched /api/v1 route. Returns null when allowed, or
 * the error message for the 403 response.
 */
export function checkApiKeyAccess(
	apiKey: ResolvedApiKey,
	routeId: string,
	method: string
): string | null {
	if (apiKey.permissions === 'all') return null;

	const requirement = getApiRequirement(routeId, method);
	if (!requirement) {
		return 'API key does not have access to this endpoint';
	}

	if (hasApiAccess(apiKey.permissions, requirement.area, requirement.access)) {
		return null;
	}

	const areaName = API_AREAS.find((a) => a.id === requirement.area)?.name ?? requirement.area;
	return `API key does not have ${requirement.access} access to ${areaName}`;
}
