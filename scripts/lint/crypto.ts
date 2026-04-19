/**
 * no-insecure-uuid lint script
 *
 * `window.crypto.randomUUID` is only available in browser secure contexts
 * (HTTPS or localhost). Profilarr is commonly served over plain HTTP on a
 * LAN, where calling it throws `TypeError: crypto.randomUUID is not a
 * function` and crashes the page.
 *
 * A safe wrapper exists at `src/lib/shared/utils/uuid.ts` (`uuid()`) that
 * falls back to a `Math.random()`-based UUID outside secure contexts. This
 * rule blocks new `crypto.randomUUID()` calls in code that may run in the
 * browser, directing authors to that wrapper instead.
 *
 * Severity:
 *   - error in `src/lib/client/**` and client-side `src/routes/**` (always
 *     browser code).
 *   - warn in `src/lib/shared/**` because shared code can run on either
 *     side. Suppressible with a directive comment on the previous line:
 *
 *         // lint-disable-next-line no-insecure-uuid -- server-only path
 *         crypto.randomUUID();
 *
 *     Reason after `--` is required and must be non-empty. A malformed
 *     directive (missing reason, wrong rule name, missing `--`) becomes its
 *     own warning instead of silently exempting the call.
 *   - server files are out of scope (Deno, secure context not applicable).
 *     Routes excluded: `+server.ts`, `+page.server.ts`, `+layout.server.ts`,
 *     `hooks.server.ts`, `*.server.ts/.js`.
 *   - `src/lib/shared/utils/uuid.ts` itself is exempt (it IS the wrapper).
 *
 * Usage:
 *   deno task lint:crypto
 *
 * Issue: https://github.com/Dictionarry-Hub/profilarr/issues/458
 */

import { parse } from 'svelte/compiler';
import {
	buildLineOffsets,
	classifyDirective,
	collectFiles,
	type Colorizer,
	type CommentStatus,
	offsetToLineCol,
	pickColorizer
} from './_lib.ts';

// ============================================================================
// CONFIGURATION
// ============================================================================

const RULE_NAME = 'no-insecure-uuid';
const SUGGESTION = "import `uuid` from '$shared/utils/uuid'";

const SCOPE_ROOTS = ['src/routes', 'src/lib/client', 'src/lib/shared'];
const EXEMPT_FILES = new Set(['src/lib/shared/utils/uuid.ts']);

// Fast pre-filter: skip the file entirely if `crypto.randomUUID(` doesn't
// appear in the raw source.
const SCAN_RE = /\bcrypto\.randomUUID\s*\(/;

// Real matcher run on stripped source: also catches `window.crypto.…` and
// `globalThis.crypto.…`.
const MATCH_RE = /\b(?:(?:window|globalThis)\s*\.\s*)?crypto\s*\.\s*randomUUID\s*\(/g;

const FILE_EXT_RE = /\.(?:svelte|ts|js)$/;

// SvelteKit server-only file conventions
function isServerFile(file: string): boolean {
	if (/\+server\.(?:ts|js)$/.test(file)) return true;
	if (/\.server\.(?:ts|js)$/.test(file)) return true;
	if (/(?:^|\/)hooks\.server\.(?:ts|js)$/.test(file)) return true;
	return false;
}

type Severity = 'error' | 'warn';

function severityFor(file: string): Severity | null {
	if (EXEMPT_FILES.has(file)) return null;
	if (file.startsWith('src/lib/shared/')) return 'warn';
	if (file.startsWith('src/lib/client/')) return 'error';
	if (file.startsWith('src/routes/')) {
		if (isServerFile(file)) return null;
		return 'error';
	}
	return null;
}

// ============================================================================
// TYPES
// ============================================================================

interface BaseViolation {
	file: string;
	line: number;
	column: number;
	severity: Severity;
}

interface InsecureUuidViolation extends BaseViolation {
	kind: 'insecure-uuid';
}

interface MalformedDirectiveViolation extends BaseViolation {
	kind: 'malformed-directive';
	reason: string;
}

interface ParseErrorViolation extends BaseViolation {
	kind: 'parse-error';
	message: string;
}

interface ReadErrorViolation extends BaseViolation {
	kind: 'read-error';
	message: string;
}

type Violation =
	| InsecureUuidViolation
	| MalformedDirectiveViolation
	| ParseErrorViolation
	| ReadErrorViolation;

// Minimal Svelte AST shape. We only touch `instance` and `module` script
// blocks; their `content` carries byte offsets into the original source.
interface ScriptBlock {
	start: number;
	end: number;
	content: { start: number; end: number };
}

interface SvelteRoot {
	type: 'Root';
	instance: ScriptBlock | null;
	module: ScriptBlock | null;
}

// ============================================================================
// FILE DISCOVERY
// ============================================================================

function collectTargetFiles(): Promise<string[]> {
	return collectFiles({
		roots: SCOPE_ROOTS,
		acceptFile: (rel) => FILE_EXT_RE.test(rel) && severityFor(rel) !== null
	});
}

// ============================================================================
// COMMENT / STRING STRIPPER
//
// Replaces comments and string-literal contents with spaces (preserving
// newlines so line numbers stay accurate). Template literals are handled
// with brace tracking so `crypto.randomUUID()` calls inside `${…}`
// expressions are NOT stripped.
// ============================================================================

function stripCommentsAndStrings(src: string): string {
	const n = src.length;
	const out = new Array<string>(n);

	// Stack of active template literals. Each entry tracks the brace depth
	// inside the current `${…}` expression. depth 0 means we're in literal
	// text (between backticks); depth > 0 means we're in code inside `${…}`.
	const tpls: { exprDepth: number }[] = [];

	const inTplText = () => tpls.length > 0 && tpls[tpls.length - 1].exprDepth === 0;

	let i = 0;
	while (i < n) {
		const ch = src[i];
		const nx = src[i + 1] ?? '';

		if (inTplText()) {
			if (ch === '\\' && i + 1 < n) {
				out[i] = ' ';
				out[i + 1] = src[i + 1] === '\n' ? '\n' : ' ';
				i += 2;
				continue;
			}
			if (ch === '`') {
				out[i] = ' ';
				i++;
				tpls.pop();
				continue;
			}
			if (ch === '$' && nx === '{') {
				out[i] = ' ';
				out[i + 1] = ' ';
				i += 2;
				tpls[tpls.length - 1].exprDepth = 1;
				continue;
			}
			out[i] = ch === '\n' ? '\n' : ' ';
			i++;
			continue;
		}

		// Code mode (top-level OR inside a `${…}` expression).

		if (ch === '/' && nx === '/') {
			while (i < n && src[i] !== '\n') {
				out[i] = ' ';
				i++;
			}
			continue;
		}

		if (ch === '/' && nx === '*') {
			out[i] = ' ';
			out[i + 1] = ' ';
			i += 2;
			while (i < n) {
				if (src[i] === '*' && src[i + 1] === '/') {
					out[i] = ' ';
					out[i + 1] = ' ';
					i += 2;
					break;
				}
				out[i] = src[i] === '\n' ? '\n' : ' ';
				i++;
			}
			continue;
		}

		if (ch === '"' || ch === "'") {
			const quote = ch;
			out[i] = ' ';
			i++;
			while (i < n) {
				if (src[i] === '\\' && i + 1 < n) {
					out[i] = ' ';
					out[i + 1] = src[i + 1] === '\n' ? '\n' : ' ';
					i += 2;
					continue;
				}
				if (src[i] === quote) {
					out[i] = ' ';
					i++;
					break;
				}
				if (src[i] === '\n') {
					// Unterminated string literal — bail out cleanly.
					break;
				}
				out[i] = ' ';
				i++;
			}
			continue;
		}

		if (ch === '`') {
			out[i] = ' ';
			i++;
			tpls.push({ exprDepth: 0 });
			continue;
		}

		// Brace tracking inside template-literal expression
		if (tpls.length > 0 && tpls[tpls.length - 1].exprDepth > 0) {
			if (ch === '{') {
				tpls[tpls.length - 1].exprDepth++;
				out[i] = ch;
				i++;
				continue;
			}
			if (ch === '}') {
				tpls[tpls.length - 1].exprDepth--;
				if (tpls[tpls.length - 1].exprDepth === 0) {
					out[i] = ' ';
					i++;
					continue;
				}
				out[i] = ch;
				i++;
				continue;
			}
		}

		out[i] = ch;
		i++;
	}

	return out.join('');
}

// ============================================================================
// DIRECTIVE COMMENT
// ============================================================================

// Walk back to the previous non-blank line and look for a `//` directive.
function findPrecedingDirective(
	source: string,
	lineOffsets: number[],
	offset: number
): CommentStatus {
	const { line } = offsetToLineCol(lineOffsets, offset);
	let prev = line - 1;
	while (prev >= 1) {
		const start = lineOffsets[prev - 1];
		const end = prev < lineOffsets.length ? lineOffsets[prev] - 1 : source.length;
		const text = source.slice(start, end);
		const trimmed = text.trim();
		if (trimmed === '') {
			prev--;
			continue;
		}
		if (trimmed.startsWith('//')) {
			return classifyDirective(trimmed.slice(2).trim(), RULE_NAME);
		}
		return { kind: 'none' };
	}
	return { kind: 'none' };
}

// ============================================================================
// PER-FILE LINTER
// ============================================================================

function lintScriptRange(
	file: string,
	source: string,
	scriptStart: number,
	scriptEnd: number,
	lineOffsets: number[],
	severity: Severity,
	out: Violation[]
): void {
	const slice = source.slice(scriptStart, scriptEnd);
	const stripped = stripCommentsAndStrings(slice);

	MATCH_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = MATCH_RE.exec(stripped)) !== null) {
		const matchOffset = scriptStart + m.index;
		const { line, column } = offsetToLineCol(lineOffsets, matchOffset);

		// Directives only apply in warn-scope. In error-scope the violation
		// fires regardless — the loud red error is sufficient signal.
		if (severity === 'warn') {
			const status = findPrecedingDirective(source, lineOffsets, matchOffset);
			if (status.kind === 'valid') continue;
			if (status.kind === 'malformed') {
				out.push({
					kind: 'malformed-directive',
					file,
					line,
					column,
					severity,
					reason: status.reason
				});
				continue;
			}
		}

		out.push({
			kind: 'insecure-uuid',
			file,
			line,
			column,
			severity
		});
	}
}

function lintTsFile(file: string, source: string, severity: Severity): Violation[] {
	const out: Violation[] = [];
	const lineOffsets = buildLineOffsets(source);
	lintScriptRange(file, source, 0, source.length, lineOffsets, severity, out);
	return out;
}

function lintSvelteFile(file: string, source: string, severity: Severity): Violation[] {
	const out: Violation[] = [];

	let root: SvelteRoot;
	try {
		// deno-lint-ignore no-explicit-any
		root = parse(source, { modern: true, filename: file } as any) as SvelteRoot;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		out.push({
			kind: 'parse-error',
			file,
			line: 1,
			column: 1,
			severity,
			message
		});
		return out;
	}

	const lineOffsets = buildLineOffsets(source);
	for (const block of [root.instance, root.module]) {
		if (!block?.content) continue;
		lintScriptRange(
			file,
			source,
			block.content.start,
			block.content.end,
			lineOffsets,
			severity,
			out
		);
	}
	return out;
}

function lintFile(file: string, source: string, severity: Severity): Violation[] {
	if (file.endsWith('.svelte')) return lintSvelteFile(file, source, severity);
	return lintTsFile(file, source, severity);
}

// ============================================================================
// REPORT FORMATTER
// ============================================================================

function violationLabel(v: Violation): string {
	switch (v.kind) {
		case 'insecure-uuid':
			return 'crypto.randomUUID()';
		case 'malformed-directive':
			return 'malformed directive';
		case 'parse-error':
			return 'parse error';
		case 'read-error':
			return 'read error';
	}
}

function violationDetail(v: Violation, c: Colorizer): string {
	switch (v.kind) {
		case 'insecure-uuid': {
			const arrow = c.dim('\u2192');
			return `${arrow} ${c.cyan(SUGGESTION)}`;
		}
		case 'malformed-directive':
			return c.dim(v.reason);
		case 'parse-error':
		case 'read-error':
			return c.dim(v.message);
	}
}

function colorForLabel(v: Violation, c: Colorizer): (s: string) => string {
	if (v.severity === 'error' && v.kind === 'insecure-uuid') return c.red;
	if (v.kind === 'parse-error' || v.kind === 'read-error') return c.red;
	return c.yellow;
}

function formatHeader(violations: Violation[], c: Colorizer): string {
	let errors = 0;
	let warnings = 0;
	for (const v of violations) {
		if (v.severity === 'error') errors++;
		else warnings++;
	}
	const fileCount = new Set(violations.map((v) => v.file)).size;
	const fileWord = fileCount === 1 ? 'file' : 'files';

	const parts: string[] = [];
	if (errors > 0) parts.push(c.bold(c.red(`${errors} ${errors === 1 ? 'error' : 'errors'}`)));
	if (warnings > 0)
		parts.push(c.bold(c.yellow(`${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`)));
	const counts = parts.join(c.dim(', '));

	return `${counts} across ${c.bold(`${fileCount} ${fileWord}`)} ${c.dim(`(${RULE_NAME})`)}`;
}

function formatReport(violations: Violation[], c: Colorizer): string {
	const lines: string[] = [];

	const byFile = new Map<string, Violation[]>();
	for (const v of violations) {
		const arr = byFile.get(v.file);
		if (arr) arr.push(v);
		else byFile.set(v.file, [v]);
	}

	lines.push(formatHeader(violations, c));
	lines.push('');
	lines.push(c.dim('\u2500'.repeat(60)));
	lines.push('');

	const fileEntries = [...byFile.entries()].sort((a, b) => {
		if (b[1].length !== a[1].length) return b[1].length - a[1].length;
		return a[0].localeCompare(b[0]);
	});

	for (let fi = 0; fi < fileEntries.length; fi++) {
		const [file, fileViolations] = fileEntries[fi];
		const sorted = [...fileViolations].sort((a, b) => {
			if (a.line !== b.line) return a.line - b.line;
			return a.column - b.column;
		});

		lines.push(`${c.bold(file)} ${c.dim(`(${fileViolations.length})`)}`);

		const maxLocWidth = Math.max(...sorted.map((v) => `${v.line}:${v.column}`.length));
		const maxLabelWidth = Math.max(...sorted.map((v) => violationLabel(v).length));

		for (const v of sorted) {
			const locStr = `${v.line}:${v.column}`.padStart(maxLocWidth);
			const labelRaw = violationLabel(v).padEnd(maxLabelWidth);
			const colored = colorForLabel(v, c)(labelRaw);
			const detail = violationDetail(v, c);
			lines.push(`  ${c.dim(locStr)}  ${colored}  ${detail}`);
		}

		if (fi < fileEntries.length - 1) lines.push('');
	}

	return lines.join('\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
	const files = await collectTargetFiles();
	const all: Violation[] = [];

	for (const file of files) {
		let source: string;
		try {
			source = await Deno.readTextFile(file);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			all.push({
				kind: 'read-error',
				file,
				line: 1,
				column: 1,
				severity: 'error',
				message
			});
			continue;
		}

		if (!SCAN_RE.test(source)) continue;
		const severity = severityFor(file);
		if (severity === null) continue;
		all.push(...lintFile(file, source, severity));
	}

	const c = pickColorizer();

	if (all.length === 0) {
		console.log(`${c.green('\u2713')} no insecure UUID calls ${c.dim(`(${RULE_NAME})`)}`);
		Deno.exit(0);
	}

	console.log(formatReport(all, c));

	const errorCount = all.filter((v) => v.severity === 'error').length;
	Deno.exit(errorCount > 0 ? 1 : 0);
}

if (import.meta.main) {
	await main();
}
