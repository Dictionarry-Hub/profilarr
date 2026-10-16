/**
 * lucide-imports lint
 *
 * Rule: import Lucide icons from their own module, e.g.
 *
 *   import Clock from '@lucide/svelte/icons/clock';
 *
 * not from the package root (`'@lucide/svelte'` or `'@lucide/svelte/icons'`).
 * The root re-exports every icon, and the Vite dev server doesn't tree-shake,
 * so one root import compiles every icon on the first page load.
 * Production builds tree-shake either way. Type-only imports are allowed.
 *
 * Usage: deno run --allow-read --allow-env scripts/lint/lucideImports.ts
 */

import { buildLineOffsets, collectFiles, offsetToLineCol } from './_lib.ts';

const RULE_NAME = 'lucide-imports';
const SCOPE_ROOTS = ['src'];
const FILE_EXT_RE = /\.(?:svelte|ts|js)$/;

const ROOT_SPECIFIER = `['"]@lucide/svelte(?:/icons)?['"]`;
const STATIC_RE = new RegExp(
	`\\b(import|export)\\s+(type\\s+)?[^;'"]*?\\bfrom\\s*${ROOT_SPECIFIER}`,
	'g'
);
const DYNAMIC_RE = new RegExp(`\\bimport\\s*\\(\\s*${ROOT_SPECIFIER}\\s*\\)`, 'g');

interface Violation {
	file: string;
	line: number;
}

function lintFile(file: string, source: string): Violation[] {
	const offsets = buildLineOffsets(source);
	const out: Violation[] = [];

	for (const m of source.matchAll(STATIC_RE)) {
		if (m[2]) continue; // import type / export type
		out.push({ file, line: offsetToLineCol(offsets, m.index).line });
	}
	for (const m of source.matchAll(DYNAMIC_RE)) {
		out.push({ file, line: offsetToLineCol(offsets, m.index).line });
	}
	return out;
}

async function main() {
	const files = await collectFiles({
		roots: SCOPE_ROOTS,
		acceptFile: (relPath) => FILE_EXT_RE.test(relPath)
	});

	const violations: Violation[] = [];
	for (const file of files) {
		const source = await Deno.readTextFile(file);
		if (!source.includes('@lucide/svelte')) continue;
		violations.push(...lintFile(file, source));
	}

	if (violations.length > 0) {
		const fileCount = new Set(violations.map((v) => v.file)).size;
		console.error(
			`${RULE_NAME}: ${violations.length} root import(s) in ${fileCount} file(s). ` +
				`Import each icon from '@lucide/svelte/icons/<name>' instead.`
		);
		for (const v of violations) {
			console.error(`  ${v.file}:${v.line}`);
		}
		Deno.exit(1);
	}

	console.log(`${RULE_NAME} lint passed (${files.length} files)`);
}

if (import.meta.main) {
	await main();
}
