/**
 * no-direct-clipboard-copy lint script
 *
 * Browser clipboard writes only work in secure contexts, so direct
 * `navigator.clipboard.writeText()` calls fail when Profilarr is served over
 * plain HTTP on a LAN. Use the client clipboard helper instead.
 *
 * Usage:
 *   deno task lint:copy
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

const RULE_NAME = 'no-direct-clipboard-copy';
const SUGGESTION = "import `copyToClipboard` from '$lib/client/utils/clipboard'";
const SCOPE_ROOTS = ['src/routes', 'src/lib/client'];
const EXEMPT_FILES = new Set(['src/lib/client/utils/clipboard.ts']);
const FILE_EXT_RE = /\.(?:svelte|ts|js)$/;

const SCAN_RE = /(?:clipboard\s*\.\s*writeText|execCommand\s*\()/;
const MATCH_RE =
	/\b(?:(?:window|globalThis)\s*\.\s*)?navigator\s*\.\s*clipboard\s*\.\s*writeText\s*\(|\b(?:(?:window|globalThis)\s*\.\s*)?document\s*\.\s*execCommand\s*\(/g;

function isServerFile(file: string): boolean {
	if (/\+server\.(?:ts|js)$/.test(file)) return true;
	if (/\.server\.(?:ts|js)$/.test(file)) return true;
	if (/(?:^|\/)hooks\.server\.(?:ts|js)$/.test(file)) return true;
	return false;
}

function isTargetFile(file: string): boolean {
	if (EXEMPT_FILES.has(file)) return false;
	if (!FILE_EXT_RE.test(file)) return false;
	if (file.startsWith('src/lib/client/')) return true;
	if (file.startsWith('src/routes/')) return !isServerFile(file);
	return false;
}

interface BaseViolation {
	file: string;
	line: number;
	column: number;
}

interface DirectCopyViolation extends BaseViolation {
	kind: 'direct-copy';
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
	| DirectCopyViolation
	| MalformedDirectiveViolation
	| ParseErrorViolation
	| ReadErrorViolation;

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

function collectTargetFiles(): Promise<string[]> {
	return collectFiles({
		roots: SCOPE_ROOTS,
		acceptFile: isTargetFile
	});
}

function stripCommentsAndStrings(src: string): string {
	const n = src.length;
	const out = new Array<string>(n);
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
				if (src[i] === '\n') break;
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
		const trimmed = source.slice(start, end).trim();
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

function lintScriptRange(
	file: string,
	source: string,
	scriptStart: number,
	scriptEnd: number,
	lineOffsets: number[],
	out: Violation[]
): void {
	const stripped = stripCommentsAndStrings(source.slice(scriptStart, scriptEnd));

	MATCH_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = MATCH_RE.exec(stripped)) !== null) {
		const matchOffset = scriptStart + m.index;
		if (m[0].includes('execCommand')) {
			const afterOpenParen = source.slice(matchOffset + m[0].length);
			if (!/^\s*(['"])copy\1/.test(afterOpenParen)) continue;
		}

		const { line, column } = offsetToLineCol(lineOffsets, matchOffset);
		const status = findPrecedingDirective(source, lineOffsets, matchOffset);

		if (status.kind === 'valid') continue;
		if (status.kind === 'malformed') {
			out.push({ kind: 'malformed-directive', file, line, column, reason: status.reason });
			continue;
		}

		out.push({ kind: 'direct-copy', file, line, column });
	}
}

function lintTsFile(file: string, source: string): Violation[] {
	const out: Violation[] = [];
	const lineOffsets = buildLineOffsets(source);
	lintScriptRange(file, source, 0, source.length, lineOffsets, out);
	return out;
}

function lintSvelteFile(file: string, source: string): Violation[] {
	const out: Violation[] = [];

	let root: SvelteRoot;
	try {
		// deno-lint-ignore no-explicit-any
		root = parse(source, { modern: true, filename: file } as any) as SvelteRoot;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		out.push({ kind: 'parse-error', file, line: 1, column: 1, message });
		return out;
	}

	const lineOffsets = buildLineOffsets(source);
	for (const block of [root.instance, root.module]) {
		if (!block?.content) continue;
		lintScriptRange(file, source, block.content.start, block.content.end, lineOffsets, out);
	}
	return out;
}

function lintFile(file: string, source: string): Violation[] {
	if (file.endsWith('.svelte')) return lintSvelteFile(file, source);
	return lintTsFile(file, source);
}

function violationLabel(v: Violation): string {
	switch (v.kind) {
		case 'direct-copy':
			return 'direct clipboard copy';
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
		case 'direct-copy':
			return `${c.dim('\u2192')} ${c.cyan(SUGGESTION)}`;
		case 'malformed-directive':
			return c.dim(v.reason);
		case 'parse-error':
		case 'read-error':
			return c.dim(v.message);
	}
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
	lines.push(c.dim('\u2500'.repeat(60)));
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
			lines.push(`  ${c.dim(locStr)}  ${c.red(labelRaw)}  ${violationDetail(v, c)}`);
		}

		if (fi < fileEntries.length - 1) lines.push('');
	}

	return lines.join('\n');
}

async function main(): Promise<void> {
	const files = await collectTargetFiles();
	const all: Violation[] = [];

	for (const file of files) {
		let source: string;
		try {
			source = await Deno.readTextFile(file);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			all.push({ kind: 'read-error', file, line: 1, column: 1, message });
			continue;
		}

		if (!SCAN_RE.test(source)) continue;
		all.push(...lintFile(file, source));
	}

	const c = pickColorizer();

	if (all.length === 0) {
		console.log(`${c.green('\u2713')} no direct clipboard copy calls ${c.dim(`(${RULE_NAME})`)}`);
		Deno.exit(0);
	}

	console.log(formatReport(all, c));
	Deno.exit(1);
}

if (import.meta.main) {
	await main();
}
