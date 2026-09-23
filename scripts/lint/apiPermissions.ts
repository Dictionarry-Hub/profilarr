/**
 * API permission lint script
 *
 * Every authenticated /api/v1 operation must declare which access it needs,
 * so scoped API keys are checked against it (see
 * `src/lib/server/utils/auth/apiPermissions.ts`). An operation without a
 * label is denied to every scoped key, which is safe but almost always a
 * mistake, so this rule fails CI instead.
 *
 * Spec rules, checked against the bundled spec (`src/lib/api/v1.openapi.json`):
 *   - `x-permission` is `read` or `write`
 *   - exactly one tag, which is the operation's area
 *   - the tag is declared in the spec's top-level `tags`
 *
 * Route rule: every handler exported from a `+server.ts` under
 * `src/routes/api/v1` resolves to a labelled operation, using the same lookup
 * the server uses at runtime. This catches handlers missing from the spec and
 * route paths that don't match their spec path, which the spec rules can't see.
 *
 * Public operations (`security: []`) and public paths are skipped.
 *
 * Usage:
 *   deno task lint:api-permissions
 */

import { getApiRequirement } from '../../src/lib/server/utils/auth/apiPermissions.ts';
import { isPublicPath } from '../../src/lib/server/utils/auth/publicPaths.ts';

const SPEC_PATH = 'src/lib/api/v1.openapi.json';
const ROUTES_ROOT = 'src/routes';
const API_V1_ROUTES = `${ROUTES_ROOT}/api/v1`;
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const EXPORTED_METHOD_RE =
	/export\s+(?:const|(?:async\s+)?function)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

interface SpecOperation {
	operationId?: string;
	tags?: string[];
	security?: unknown[];
	'x-permission'?: unknown;
}

interface Spec {
	tags?: { name: string }[];
	paths: Record<string, Record<string, SpecOperation>>;
}

const spec = JSON.parse(await Deno.readTextFile(SPEC_PATH)) as Spec;
const declaredTags = new Set((spec.tags ?? []).map((tag) => tag.name));
const violations: string[] = [];

for (const [path, item] of Object.entries(spec.paths)) {
	for (const method of HTTP_METHODS) {
		const operation = item[method];
		if (!operation) continue;
		if (Array.isArray(operation.security) && operation.security.length === 0) continue;

		const operationId = operation.operationId ? ` (${operation.operationId})` : '';
		const label = `${method.toUpperCase()} ${path}${operationId}`;
		const access = operation['x-permission'];
		const tags = operation.tags ?? [];

		if (access !== 'read' && access !== 'write') {
			violations.push(`${label}: x-permission must be "read" or "write"`);
		}

		if (tags.length !== 1) {
			violations.push(`${label}: must have exactly one tag, found ${tags.length}`);
		} else if (!declaredTags.has(tags[0])) {
			violations.push(`${label}: tag "${tags[0]}" is not declared in the spec's tags`);
		}
	}
}

async function collectServerFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	for await (const entry of Deno.readDir(dir)) {
		const path = `${dir}/${entry.name}`;
		if (entry.isDirectory) files.push(...(await collectServerFiles(path)));
		else if (entry.name === '+server.ts') files.push(path);
	}
	return files;
}

for (const file of (await collectServerFiles(API_V1_ROUTES)).sort()) {
	const routeId = file.slice(ROUTES_ROOT.length, -'/+server.ts'.length);
	if (isPublicPath(routeId)) continue;

	const source = await Deno.readTextFile(file);
	for (const match of source.matchAll(EXPORTED_METHOD_RE)) {
		if (!getApiRequirement(routeId, match[1])) {
			violations.push(`${match[1]} ${routeId}: no labelled operation in the spec`);
		}
	}
}

if (violations.length > 0) {
	console.error('API permission labels missing or invalid:');
	for (const violation of violations) {
		console.error(`- ${violation}`);
	}
	console.error('\nAdd or fix the operation in docs/api/v1/paths/, then regenerate the spec:');
	console.error('  deno task generate:api-types');
	Deno.exit(1);
}
