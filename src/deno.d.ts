/**
 * Deno global type declarations for SvelteKit project
 */

// Note: Deno namespace types are provided by Deno's built-in lib.deno.ns.d.ts
// Do not redeclare them here to avoid conflicts

// JSR package declarations for svelte-check compatibility.
// svelte-check resolves modules via node_modules, not Deno's import map, so it
// can't follow the `@db/sqlite -> npm:@jsr/db__sqlite` alias. Re-export the real
// types from the installed npm-compat package so types stay accurate.
declare module '@db/sqlite' {
	export * from '@jsr/db__sqlite';
}

declare module '@felix/bcrypt' {
	export function hash(password: string, rounds?: number): Promise<string>;
	export function verify(password: string, hash: string): Promise<boolean>;
}

declare module '@std/yaml' {
	export function parse(content: string, options?: Record<string, unknown>): unknown;
	export function stringify(data: unknown, options?: Record<string, unknown>): string;
}
