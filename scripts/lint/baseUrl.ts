/**
 * base-url lint script
 *
 * Profilarr can be served from a subpath behind a reverse proxy (BASE_URL, the
 * equivalent of Radarr's and Sonarr's "URL Base"). Every internal URL therefore has
 * to carry the base:
 *
 *   client code  resolve('/settings')   with `import { resolve } from '$app/paths'`
 *   server code  redirect(303, '/auth/login') from '$utils/redirect/redirect.ts'
 *
 * A hard-coded '/settings' works fine at the root and 404s behind a proxy, which is
 * exactly the kind of breakage nobody notices until someone reports it. This rule
 * flags the common shapes:
 *
 *   href="/x"  action="/x"  fetch('/x')  goto('/x')  EventSource('/x')
 *   location.href = '/x'    href: '/x'
 *   `${base}/x`                               (deprecated, use resolve())
 *   import { redirect } from '@sveltejs/kit'  (server files)
 *
 * `resolve()` is preferred over the deprecated `base` export because it typechecks the
 * path against the app's generated route union, so a link to a route that doesn't exist
 * fails `deno task check` instead of 404ing in production.
 *
 * Escape hatch:
 *   // lint-disable-next-line base-url -- reason goes here
 *
 * Usage:
 *   deno task lint:base-url
 */

import {
	buildLineOffsets,
	classifyDirective,
	collectFiles,
	type Colorizer,
	offsetToLineCol,
	pickColorizer
} from './_lib.ts';

const RULE_NAME = 'base-url';
const SCOPE_ROOTS = ['src/routes', 'src/lib/client'];
const EXTRA_FILES = ['src/hooks.server.ts'];
const FILE_EXT_RE = /\.(?:svelte|ts|js)$/;

/**
 * Files that legitimately deal in plain app paths, or in `base` itself.
 * - routePath.ts implements the prefixing itself, and needs `base` as a value to strip.
 * - The redirect helper is what server code is told to import.
 * - Cutscene step definitions and route resolvers are data: CutsceneOverlay applies the
 *   base at the navigation boundary, where the path is only known at runtime and so
 *   can't go through `resolve()`.
 */
const EXEMPT_FILES = new Set([
	'src/lib/client/utils/routePath.ts',
	'src/lib/client/cutscene/routeResolvers.ts',
	'src/lib/client/cutscene/CutsceneOverlay.svelte'
]);
const EXEMPT_PREFIXES = ['src/lib/client/cutscene/definitions/'];

/** Client-side shapes: an app-absolute URL that isn't prefixed with `base`. */
const CLIENT_PATTERNS: { re: RegExp; label: string; hint: string }[] = [
	{
		re: /\b(?:href|action|buttonHref)="\/(?!\/)/g,
		label: 'unprefixed href',
		hint: "use href={resolve('/...')}"
	},
	{
		re: /\b(?:href|action|buttonHref)=\{`\/(?!\/)/g,
		label: 'unprefixed href',
		hint: 'use href={resolve(`/...`)}'
	},
	{
		re: /\bhref:\s*['`]\/(?!\/)/g,
		label: 'unprefixed href',
		hint: "use href: resolve('/...')"
	},
	{
		re: /\b(?:fetch|goto|EventSource)\(\s*['`]\/(?!\/)/g,
		label: 'unprefixed request',
		hint: "use resolve('/...')"
	},
	{
		re: /location\.href\s*=\s*['`]\/(?!\/)/g,
		label: 'unprefixed navigation',
		hint: "use resolve('/...')"
	},
	{
		re: /\$\{base\}/g,
		label: 'deprecated base',
		hint: "use resolve('/...'), it typechecks the route"
	},
	{
		re: /=["']\{base\}/g,
		label: 'deprecated base',
		hint: "use ={resolve('/...')}, it typechecks the route"
	}
];

/** Server-side shape: SvelteKit's `redirect` instead of the base-aware wrapper. */
const SERVER_REDIRECT_RE = /import\s*\{[^}]*\bredirect\b[^}]*\}\s*from\s*'@sveltejs\/kit'/g;

function isServerFile(file: string): boolean {
	if (/\+server\.(?:ts|js)$/.test(file)) return true;
	if (/\.server\.(?:ts|js)$/.test(file)) return true;
	if (/(?:^|\/)hooks\.server\.(?:ts|js)$/.test(file)) return true;
	return false;
}

function isTargetFile(file: string): boolean {
	if (EXEMPT_FILES.has(file)) return false;
	if (EXEMPT_PREFIXES.some((prefix) => file.startsWith(prefix))) return false;
	return FILE_EXT_RE.test(file);
}

interface Violation {
	file: string;
	line: number;
	column: number;
	label: string;
	hint: string;
}

function findPrecedingDirective(
	source: string,
	lineOffsets: number[],
	offset: number
): ReturnType<typeof classifyDirective> {
	const { line } = offsetToLineCol(lineOffsets, offset);
	let prev = line - 1;
	while (prev >= 1) {
		const start = lineOffsets[prev - 1];
		const end = prev < lineOffsets.length ? lineOffsets[prev] - 1 : source.length;
		const trimmed = source.slice(start, end).trim();
		if (trimmed === '') {
			prev--;
			continue;
		}
		if (trimmed.startsWith('//')) return classifyDirective(trimmed.slice(2).trim(), RULE_NAME);
		if (trimmed.startsWith('<!--')) {
			return classifyDirective(trimmed.replace(/^<!--/, '').replace(/-->$/, '').trim(), RULE_NAME);
		}
		return { kind: 'none' };
	}
	return { kind: 'none' };
}

function lintFile(file: string, source: string): Violation[] {
	const out: Violation[] = [];
	const lineOffsets = buildLineOffsets(source);

	const checks = isServerFile(file)
		? [
				{
					re: SERVER_REDIRECT_RE,
					label: 'kit redirect',
					hint: "import { redirect } from '$utils/redirect/redirect.ts'"
				}
			]
		: CLIENT_PATTERNS;

	for (const { re, label, hint } of checks) {
		re.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(source)) !== null) {
			const status = findPrecedingDirective(source, lineOffsets, m.index);
			if (status.kind === 'valid') continue;
			const { line, column } = offsetToLineCol(lineOffsets, m.index);
			if (status.kind === 'malformed') {
				out.push({ file, line, column, label: 'malformed directive', hint: status.reason });
				continue;
			}
			out.push({ file, line, column, label, hint });
		}
	}

	return out;
}

function formatReport(violations: Violation[], c: Colorizer): string {
	const lines: string[] = [];
	const fileCount = new Set(violations.map((v) => v.file)).size;
	const count = violations.length;
	lines.push(
		`${c.bold(c.red(`${count} ${count === 1 ? 'error' : 'errors'}`))} across ${c.bold(
			`${fileCount} ${fileCount === 1 ? 'file' : 'files'}`
		)} ${c.dim(`(${RULE_NAME})`)}`
	);
	lines.push('');
	lines.push(c.dim('─'.repeat(60)));
	lines.push('');

	const byFile = new Map<string, Violation[]>();
	for (const v of violations) {
		const arr = byFile.get(v.file);
		if (arr) arr.push(v);
		else byFile.set(v.file, [v]);
	}

	const fileEntries = [...byFile.entries()].sort((a, b) => {
		if (b[1].length !== a[1].length) return b[1].length - a[1].length;
		return a[0].localeCompare(b[0]);
	});

	for (let fi = 0; fi < fileEntries.length; fi++) {
		const [file, fileViolations] = fileEntries[fi];
		const sorted = [...fileViolations].sort((a, b) => a.line - b.line || a.column - b.column);

		lines.push(`${c.bold(file)} ${c.dim(`(${fileViolations.length})`)}`);

		const maxLocWidth = Math.max(...sorted.map((v) => `${v.line}:${v.column}`.length));
		const maxLabelWidth = Math.max(...sorted.map((v) => v.label.length));

		for (const v of sorted) {
			const locStr = `${v.line}:${v.column}`.padStart(maxLocWidth);
			const labelRaw = v.label.padEnd(maxLabelWidth);
			lines.push(`  ${c.dim(locStr)}  ${c.red(labelRaw)}  ${c.dim('→')} ${c.cyan(v.hint)}`);
		}

		if (fi < fileEntries.length - 1) lines.push('');
	}

	return lines.join('\n');
}

async function main(): Promise<void> {
	const files = [
		...(await collectFiles({
			roots: SCOPE_ROOTS,
			acceptFile: isTargetFile
		})),
		...EXTRA_FILES
	];

	const all: Violation[] = [];
	for (const file of files) {
		let source: string;
		try {
			source = await Deno.readTextFile(file);
		} catch {
			continue;
		}
		all.push(...lintFile(file, source));
	}

	const c = pickColorizer();

	if (all.length === 0) {
		console.log(`${c.green('✓')} all internal URLs carry the base URL ${c.dim(`(${RULE_NAME})`)}`);
		Deno.exit(0);
	}

	console.log(formatReport(all, c));
	Deno.exit(1);
}

if (import.meta.main) {
	await main();
}
