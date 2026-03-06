/**
 * Bundle the multi-file OpenAPI spec into a single JSON file
 * and copy generated types for the JSR package.
 *
 * Usage: deno run -A scripts/bundle-api.ts
 */

import { parse } from '@std/yaml';
import { join, dirname } from 'jsr:@std/path@^1';

const SPEC_DIR = 'docs/api/v1';
const OUT_DIR = 'packages/profilarr-api';

// ── Helpers ──

function readYaml(path: string): Record<string, unknown> {
	return parse(Deno.readTextFileSync(path)) as Record<string, unknown>;
}

/**
 * Resolve a file $ref like './paths/arr.yaml#/library' relative to a base directory.
 * Returns the value at the fragment path within the parsed YAML file.
 */
function resolveFileRef(ref: string, baseDir: string): { value: unknown; fileDir: string } {
	const [filePath, fragment] = ref.split('#/');
	const fullPath = join(baseDir, filePath);
	const content = readYaml(fullPath);
	const value = fragment ? content[fragment] : content;
	return { value, fileDir: dirname(fullPath) };
}

/**
 * Walk an object tree and convert all file/local $refs to internal
 * #/components/schemas/X format.
 */
// deno-lint-ignore no-explicit-any
function convertRefs(obj: any): any {
	if (typeof obj !== 'object' || obj === null) return obj;

	if (Array.isArray(obj)) {
		return obj.map((item) => convertRefs(item));
	}

	if (obj.$ref && typeof obj.$ref === 'string') {
		const ref: string = obj.$ref;

		// Already internal component ref — leave as-is
		if (ref.startsWith('#/components/')) {
			return obj;
		}

		// Local ref like '#/CustomFormatRef' → '#/components/schemas/CustomFormatRef'
		if (ref.startsWith('#/')) {
			return { $ref: `#/components/schemas/${ref.substring(2)}` };
		}

		// File ref like '../schemas/arr.yaml#/ErrorResponse' → extract fragment name
		if (ref.includes('#/')) {
			const fragment = ref.split('#/')[1];
			return { $ref: `#/components/schemas/${fragment}` };
		}

		return obj;
	}

	// deno-lint-ignore no-explicit-any
	const result: Record<string, any> = {};
	for (const [key, value] of Object.entries(obj)) {
		result[key] = convertRefs(value);
	}
	return result;
}

// ── Main ──

const root = readYaml(join(SPEC_DIR, 'openapi.yaml'));

// 1. Collect all schemas from all schema files
// The root openapi.yaml lists schemas like: SchemaName: { $ref: './schemas/X.yaml#/SchemaName' }
// But schema files may contain additional schemas only referenced locally (e.g., SqliteHealth).
// Strategy: for each schema file referenced, import ALL top-level keys.

// deno-lint-ignore no-explicit-any
const schemas: Record<string, any> = {};
const schemaFilesLoaded = new Set<string>();

const rootSchemas = (root.components as Record<string, unknown>)?.schemas as
	| Record<string, { $ref?: string }>
	| undefined;

if (rootSchemas) {
	for (const [, schemaRef] of Object.entries(rootSchemas)) {
		if (!schemaRef?.$ref) continue;

		const filePath = schemaRef.$ref.split('#/')[0];
		const fullPath = join(SPEC_DIR, filePath);

		// Only load each file once — grab ALL top-level keys
		if (schemaFilesLoaded.has(fullPath)) continue;
		schemaFilesLoaded.add(fullPath);

		const fileContent = readYaml(fullPath);
		for (const [name, definition] of Object.entries(fileContent)) {
			schemas[name] = definition;
		}
	}
}

// 2. Resolve paths — each path ref points to a path file
// deno-lint-ignore no-explicit-any
const paths: Record<string, any> = {};
const rootPaths = root.paths as Record<string, { $ref?: string }> | undefined;

if (rootPaths) {
	for (const [pathKey, pathRef] of Object.entries(rootPaths)) {
		if (!pathRef?.$ref) {
			paths[pathKey] = pathRef;
			continue;
		}

		const { value } = resolveFileRef(pathRef.$ref, SPEC_DIR);
		paths[pathKey] = value;
	}
}

// 3. Convert all $refs to internal format
const resolvedSchemas = convertRefs(schemas);
const resolvedPaths = convertRefs(paths);

// 4. Build final spec
const bundled = {
	openapi: root.openapi,
	info: root.info,
	servers: root.servers,
	tags: root.tags,
	paths: resolvedPaths,
	components: {
		schemas: resolvedSchemas
	}
};

// 5. Write bundled spec
const specPath = join(OUT_DIR, 'openapi.json');
Deno.writeTextFileSync(specPath, JSON.stringify(bundled, null, 2) + '\n');
console.log(`Wrote bundled spec to ${specPath}`);

// 6. Copy generated types and inject JSDoc on exported symbols
const typesSource = 'src/lib/api/v1.d.ts';
const typesDest = join(OUT_DIR, 'types.ts');
let typesContent = Deno.readTextFileSync(typesSource);

const symbolDocs: Record<string, string> = {
	'export interface paths':
		'/** API endpoint path definitions mapping URL patterns to their HTTP methods and operations. */',
	'export type webhooks': '/** Webhook event definitions. Currently unused. */',
	'export interface components':
		'/** API component schemas including all request bodies, response types, and shared models. */',
	'export type $defs': '/** JSON Schema definitions. Currently unused. */',
	'export interface operations':
		'/** API operation definitions with typed parameters, request bodies, and responses. */'
};

for (const [symbol, doc] of Object.entries(symbolDocs)) {
	typesContent = typesContent.replace(symbol, `${doc}\n${symbol}`);
}

Deno.writeTextFileSync(typesDest, typesContent);
console.log(`Copied types to ${typesDest}`);
