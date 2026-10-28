// Deno installs @std/assert under its npm name only; vitest.config.ts aliases
// it at runtime. Removed once the unit tests use Vitest's `expect`.
declare module '@std/assert' {
	export * from '@jsr/std__assert';
}
