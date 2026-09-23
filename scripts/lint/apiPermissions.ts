/**
 * API permission lint script
 *
 * Every authenticated /api/v1 operation must declare which access it needs,
 * so scoped API keys are checked against it (see
 * `src/lib/server/utils/auth/apiPermissions.ts`). An operation without a
 * label is denied to every scoped key, which is safe but almost always a
 * mistake, so this rule fails CI instead.
 *
 * Rules, checked against the bundled spec (`src/lib/api/v1.openapi.json`):
 *   - `x-permission` is `read` or `write`
 *   - exactly one tag, which is the operation's area
 *   - the tag is declared in the spec's top-level `tags`
 *
 * Public operations (`security: []`) are skipped.
 *
 * Usage:
 *   deno task lint:api-permissions
 */

const SPEC_PATH = 'src/lib/api/v1.openapi.json';
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

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

if (violations.length > 0) {
	console.error('API permission labels missing or invalid:');
	for (const violation of violations) {
		console.error(`- ${violation}`);
	}
	console.error('\nFix the operation in docs/api/v1/paths/, then regenerate the spec:');
	console.error('  deno task generate:api-types');
	Deno.exit(1);
}
