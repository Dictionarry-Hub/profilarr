/**
 * @module
 * OpenAPI specification and TypeScript types for the Profilarr API.
 *
 * ```ts
 * import { spec } from "@dictionarry/profilarr-api";
 * import type { components } from "@dictionarry/profilarr-api";
 *
 * // Access the bundled OpenAPI spec
 * console.log(spec.info.title);
 *
 * // Use typed schemas
 * type Movie = components["schemas"]["RadarrLibraryItem"];
 * ```
 */

/** Bundled OpenAPI 3.1 specification with all $refs resolved. */
export { default as spec } from './openapi.json' with { type: 'json' };

/** TypeScript types generated from the OpenAPI specification. */
export type * from './types.ts';
