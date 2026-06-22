/**
 * Deno global type declarations for SvelteKit project
 */

// Note: Deno namespace types are provided by Deno's built-in lib.deno.ns.d.ts
// Do not redeclare them here to avoid conflicts

// JSR package declarations for svelte-check compatibility
declare module '@felix/bcrypt' {
	export function hash(password: string, rounds?: number): Promise<string>;
	export function verify(password: string, hash: string): Promise<boolean>;
}

declare module '@std/yaml' {
	export function parse(content: string, options?: Record<string, unknown>): unknown;
	export function stringify(data: unknown, options?: Record<string, unknown>): string;
}
