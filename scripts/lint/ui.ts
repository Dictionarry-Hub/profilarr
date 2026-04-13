/**
 * no-raw-ui Svelte lint script
 *
 * Enforces the convention that UI code uses wrapper components from `$ui/*`
 * rather than raw HTML elements. Parses `.svelte` files with the official
 * Svelte 5 compiler AST and walks the template tree looking for banned tags.
 *
 * Scope: `.svelte` files under `src/routes/` and `src/lib/client/`, excluding
 * `src/lib/client/ui/` (those ARE the wrapper components and may use raw HTML).
 *
 * Banned tags: <button>, <input>, <select>, <textarea>, <dialog>, <table>.
 *
 * Exemption: <input type="hidden"> when the `type` attribute is a static string
 * literal equal to `"hidden"`. Hidden inputs are SvelteKit form-action plumbing,
 * not visible UI, and there are ~140 of them in the codebase.
 *
 * Escape hatch: an HTML comment placed immediately before the element:
 *
 *     <!-- lint-disable-next-line no-raw-ui -- reason goes here -->
 *     <table class="w-full">
 *
 * The reason (after `--`) is required and must be non-empty. Malformed
 * directives (missing reason, wrong rule name, missing `--`) produce an error
 * diagnostic instead of silently exempting the element.
 *
 * Usage:
 *   deno task lint:ui
 *
 * Issue: https://github.com/Dictionarry-Hub/profilarr/issues/298
 */

import { parse } from 'svelte/compiler';

// ============================================================================
// CONFIGURATION
// ============================================================================

const RULE_NAME = 'no-raw-ui';

const BANNED_TAGS = new Set(['button', 'input', 'select', 'textarea', 'dialog', 'table']);

const SCOPE_ROOTS = ['src/routes', 'src/lib/client'];
const EXCLUDED_PREFIX = 'src/lib/client/ui/';
const SKIP_DIRS = new Set(['.svelte-kit', 'node_modules']);

// Fast pre-filter: if none of these tag names appear in a file's raw source,
// the parse can be skipped entirely.
const BANNED_SCAN_RE = /<(button|input|select|textarea|dialog|table)\b/;

// ============================================================================
// SUGGESTIONS
// ============================================================================

interface Suggestion {
	component: string;
	note?: string;
}

const SIMPLE_SUGGESTIONS: Record<string, Suggestion> = {
	button: { component: '$ui/button/Button.svelte' },
	select: { component: '$ui/dropdown/DropdownSelect.svelte' },
	textarea: { component: '$ui/form/MarkdownInput.svelte' },
	dialog: { component: '$ui/modal/Modal.svelte' },
	table: { component: '$ui/table/Table.svelte' }
};

const INPUT_SUGGESTIONS: Record<string, Suggestion> = {
	checkbox: {
		component: '$ui/toggle/Toggle.svelte',
		note: 'or $ui/form/IconCheckbox.svelte'
	},
	number: { component: '$ui/form/NumberInput.svelte' },
	date: { component: '$ui/form/DateInput.svelte' },
	time: { component: '$ui/form/TimeInput.svelte' }
};

const INPUT_DEFAULT: Suggestion = { component: '$ui/form/FormInput.svelte' };

// ============================================================================
// TYPES
// ============================================================================

interface BaseViolation {
	file: string;
	line: number;
	column: number;
}

interface RawUiViolation extends BaseViolation {
	kind: 'raw-ui';
	tag: string;
	suggestion: Suggestion;
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
	| RawUiViolation
	| MalformedDirectiveViolation
	| ParseErrorViolation
	| ReadErrorViolation;

interface WalkContext {
	file: string;
	offsets: number[];
	out: Violation[];
}

type CommentStatus =
	| { kind: 'none' }
	| { kind: 'valid'; reason: string }
	| { kind: 'malformed'; reason: string };

// Svelte AST types - we pin just the shapes we touch, since importing the full
// `AST` namespace from `npm:svelte/compiler` through Deno's compat shim is
// fiddly. Keeping these minimal avoids coupling to compiler internals.

interface BaseNode {
	type: string;
	start: number;
	end: number;
}

interface TextNode extends BaseNode {
	type: 'Text';
	data: string;
}

interface CommentNode extends BaseNode {
	type: 'Comment';
	data: string;
}

interface Fragment {
	type: 'Fragment';
	nodes: AnyNode[];
}

interface AttributeNode extends BaseNode {
	type: 'Attribute';
	name: string;
	value: true | TextNode[] | AnyNode[];
}

interface RegularElement extends BaseNode {
	type: 'RegularElement';
	name: string;
	attributes: AnyNode[];
	fragment: Fragment;
}

interface ElementLike extends BaseNode {
	type: string;
	fragment?: Fragment;
}

interface IfBlock extends BaseNode {
	type: 'IfBlock';
	consequent: Fragment;
	alternate: Fragment | null;
}

interface EachBlock extends BaseNode {
	type: 'EachBlock';
	body: Fragment;
	fallback: Fragment | null;
}

interface AwaitBlock extends BaseNode {
	type: 'AwaitBlock';
	pending: Fragment | null;
	then: Fragment | null;
	catch: Fragment | null;
}

interface KeyBlock extends BaseNode {
	type: 'KeyBlock';
	fragment: Fragment;
}

interface SnippetBlock extends BaseNode {
	type: 'SnippetBlock';
	body: Fragment;
}

// deno-lint-ignore no-explicit-any
type AnyNode = any;

interface SvelteRoot {
	type: 'Root';
	fragment: Fragment;
}

// ============================================================================
// FILE DISCOVERY
// ============================================================================

async function collectSvelteFiles(): Promise<string[]> {
	const out: string[] = [];

	async function walk(dir: string): Promise<void> {
		let entries: AsyncIterable<Deno.DirEntry>;
		try {
			entries = Deno.readDir(dir);
		} catch (err) {
			if (err instanceof Deno.errors.NotFound) return;
			throw err;
		}
		for await (const entry of entries) {
			if (SKIP_DIRS.has(entry.name)) continue;
			const rel = `${dir}/${entry.name}`;
			if (entry.isDirectory) {
				await walk(rel);
			} else if (entry.isFile && entry.name.endsWith('.svelte')) {
				const norm = rel.replaceAll('\\', '/');
				if (norm.startsWith(EXCLUDED_PREFIX)) continue;
				out.push(norm);
			}
		}
	}

	for (const root of SCOPE_ROOTS) {
		await walk(root);
	}

	out.sort();
	return out;
}

// ============================================================================
// POSITION HELPERS
// ============================================================================

function buildLineOffsets(source: string): number[] {
	const offsets = [0];
	for (let i = 0; i < source.length; i++) {
		if (source.charCodeAt(i) === 10 /* \n */) {
			offsets.push(i + 1);
		}
	}
	return offsets;
}

function offsetToLineCol(offsets: number[], offset: number): { line: number; column: number } {
	let lo = 0;
	let hi = offsets.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >>> 1;
		if (offsets[mid] <= offset) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}
	return { line: lo + 1, column: offset - offsets[lo] + 1 };
}

// ============================================================================
// ATTRIBUTE HELPERS
// ============================================================================

function getStaticAttrValue(attr: AttributeNode): string | null {
	if (attr.value === true) return '';
	if (!Array.isArray(attr.value)) return null;
	let out = '';
	for (const part of attr.value) {
		if (!part || part.type !== 'Text') return null;
		out += (part as TextNode).data;
	}
	return out;
}

function getInputTypeAttr(el: RegularElement): { isStatic: boolean; value: string | null } {
	for (const attr of el.attributes) {
		if (!attr || attr.type !== 'Attribute') continue;
		const a = attr as AttributeNode;
		if (a.name.toLowerCase() !== 'type') continue;
		const str = getStaticAttrValue(a);
		return { isStatic: str !== null, value: str };
	}
	return { isStatic: true, value: null };
}

function suggestionFor(el: RegularElement): Suggestion {
	if (el.name !== 'input') {
		return SIMPLE_SUGGESTIONS[el.name];
	}
	const { isStatic, value } = getInputTypeAttr(el);
	if (isStatic && value && INPUT_SUGGESTIONS[value]) {
		return INPUT_SUGGESTIONS[value];
	}
	return INPUT_DEFAULT;
}

// ============================================================================
// ESCAPE-HATCH COMMENT
// ============================================================================

function precedingCommentFor(siblings: AnyNode[], index: number): CommentNode | null {
	for (let i = index - 1; i >= 0; i--) {
		const prev = siblings[i];
		if (!prev) continue;
		if (prev.type === 'Comment') return prev as CommentNode;
		if (prev.type === 'Text') {
			const data = (prev as TextNode).data;
			if (/^\s*$/.test(data)) continue;
			return null;
		}
		return null;
	}
	return null;
}

function classifyComment(data: string): CommentStatus {
	const trimmed = data.trim();
	if (!/^lint-disable-next-line\b/.test(trimmed)) {
		return { kind: 'none' };
	}
	const m = /^lint-disable-next-line\s+(\S+)(?:\s+--\s*(.*))?$/.exec(trimmed);
	if (!m) {
		return {
			kind: 'malformed',
			reason: `directive must be: lint-disable-next-line ${RULE_NAME} -- <reason>`
		};
	}
	const [, ruleName, rawReason] = m;
	if (ruleName !== RULE_NAME) {
		return {
			kind: 'malformed',
			reason: `unknown rule "${ruleName}", expected "${RULE_NAME}"`
		};
	}
	const reason = (rawReason ?? '').trim();
	if (reason === '') {
		return {
			kind: 'malformed',
			reason: 'directive reason (after `--`) must not be empty'
		};
	}
	return { kind: 'valid', reason };
}

// ============================================================================
// WALKER
// ============================================================================

function walkFragment(nodes: AnyNode[], ctx: WalkContext): void {
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		if (!node || typeof node.type !== 'string') continue;

		switch (node.type) {
			case 'RegularElement': {
				const el = node as RegularElement;
				if (BANNED_TAGS.has(el.name)) {
					checkElement(el, nodes, i, ctx);
				}
				if (el.fragment?.nodes) {
					walkFragment(el.fragment.nodes, ctx);
				}
				break;
			}

			case 'Component':
			case 'TitleElement':
			case 'SlotElement':
			case 'SvelteComponent':
			case 'SvelteElement':
			case 'SvelteBody':
			case 'SvelteBoundary':
			case 'SvelteDocument':
			case 'SvelteFragment':
			case 'SvelteHead':
			case 'SvelteSelf':
			case 'SvelteWindow': {
				const el = node as ElementLike;
				if (el.fragment?.nodes) {
					walkFragment(el.fragment.nodes, ctx);
				}
				break;
			}

			case 'IfBlock': {
				const b = node as IfBlock;
				if (b.consequent?.nodes) walkFragment(b.consequent.nodes, ctx);
				if (b.alternate?.nodes) walkFragment(b.alternate.nodes, ctx);
				break;
			}

			case 'EachBlock': {
				const b = node as EachBlock;
				if (b.body?.nodes) walkFragment(b.body.nodes, ctx);
				if (b.fallback?.nodes) walkFragment(b.fallback.nodes, ctx);
				break;
			}

			case 'AwaitBlock': {
				const b = node as AwaitBlock;
				if (b.pending?.nodes) walkFragment(b.pending.nodes, ctx);
				if (b.then?.nodes) walkFragment(b.then.nodes, ctx);
				if (b.catch?.nodes) walkFragment(b.catch.nodes, ctx);
				break;
			}

			case 'KeyBlock': {
				const b = node as KeyBlock;
				if (b.fragment?.nodes) walkFragment(b.fragment.nodes, ctx);
				break;
			}

			case 'SnippetBlock': {
				const b = node as SnippetBlock;
				if (b.body?.nodes) walkFragment(b.body.nodes, ctx);
				break;
			}

			// Text, Comment, ExpressionTag, HtmlTag, ConstTag, DebugTag,
			// RenderTag, AttachTag: no descent needed.
		}
	}
}

function checkElement(
	el: RegularElement,
	siblings: AnyNode[],
	idx: number,
	ctx: WalkContext
): void {
	// Hidden-input exemption (static only).
	if (el.name === 'input') {
		const t = getInputTypeAttr(el);
		if (t.isStatic && t.value === 'hidden') return;
	}

	// Escape-hatch comment (immediate preceding sibling, skipping whitespace).
	const comment = precedingCommentFor(siblings, idx);
	if (comment) {
		const status = classifyComment(comment.data);
		if (status.kind === 'valid') return;
		if (status.kind === 'malformed') {
			const { line, column } = offsetToLineCol(ctx.offsets, el.start);
			ctx.out.push({
				kind: 'malformed-directive',
				file: ctx.file,
				line,
				column,
				reason: status.reason
			});
			return;
		}
		// kind === 'none' falls through to normal violation.
	}

	const suggestion = suggestionFor(el);
	const { line, column } = offsetToLineCol(ctx.offsets, el.start);
	ctx.out.push({
		kind: 'raw-ui',
		file: ctx.file,
		line,
		column,
		tag: el.name,
		suggestion
	});
}

// ============================================================================
// PER-FILE LINTER
// ============================================================================

function lintFile(file: string, source: string): Violation[] {
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
			message
		});
		return out;
	}

	if (!root?.fragment?.nodes) return out;

	const offsets = buildLineOffsets(source);
	walkFragment(root.fragment.nodes, { file, offsets, out });
	return out;
}

// ============================================================================
// COLOR
// ============================================================================

interface Colorizer {
	bold: (s: string) => string;
	dim: (s: string) => string;
	red: (s: string) => string;
	green: (s: string) => string;
	yellow: (s: string) => string;
	cyan: (s: string) => string;
}

const ansiColor: Colorizer = {
	bold: (s) => `\x1b[1m${s}\x1b[22m`,
	dim: (s) => `\x1b[2m${s}\x1b[22m`,
	red: (s) => `\x1b[31m${s}\x1b[39m`,
	green: (s) => `\x1b[32m${s}\x1b[39m`,
	yellow: (s) => `\x1b[33m${s}\x1b[39m`,
	cyan: (s) => `\x1b[36m${s}\x1b[39m`
};

const noColor: Colorizer = {
	bold: (s) => s,
	dim: (s) => s,
	red: (s) => s,
	green: (s) => s,
	yellow: (s) => s,
	cyan: (s) => s
};

// https://no-color.org/ and https://force-color.org/
function shouldUseColor(): boolean {
	// NO_COLOR: disable when set, even to an empty string.
	if (Deno.env.get('NO_COLOR') !== undefined) return false;
	// FORCE_COLOR: enable when set to any value other than "0"/"false".
	const force = Deno.env.get('FORCE_COLOR');
	if (force !== undefined && force !== '0' && force !== 'false') return true;
	try {
		return Deno.stdout.isTerminal();
	} catch {
		return false;
	}
}

// ============================================================================
// REPORT FORMATTER
// ============================================================================

function violationLabel(v: Violation): string {
	switch (v.kind) {
		case 'raw-ui':
			return `<${v.tag}>`;
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
		case 'raw-ui': {
			const arrow = c.dim('\u2192');
			const component = c.cyan(v.suggestion.component);
			const note = v.suggestion.note ? ` ${c.dim(`(${v.suggestion.note})`)}` : '';
			return `${arrow} ${component}${note}`;
		}
		case 'malformed-directive':
			return c.dim(v.reason);
		case 'parse-error':
		case 'read-error':
			return c.dim(v.message);
	}
}

interface SummaryRow {
	count: number;
	label: string;
	suggestion: string | null;
	isExtra: boolean;
}

function buildSummaryRows(violations: Violation[]): SummaryRow[] {
	const tagCounts = new Map<string, { count: number; suggestion: Suggestion }>();
	let malformedCount = 0;
	let parseErrorCount = 0;
	let readErrorCount = 0;

	for (const v of violations) {
		switch (v.kind) {
			case 'raw-ui': {
				const entry = tagCounts.get(v.tag);
				if (entry) {
					entry.count += 1;
				} else {
					tagCounts.set(v.tag, { count: 1, suggestion: v.suggestion });
				}
				break;
			}
			case 'malformed-directive':
				malformedCount += 1;
				break;
			case 'parse-error':
				parseErrorCount += 1;
				break;
			case 'read-error':
				readErrorCount += 1;
				break;
		}
	}

	const rows: SummaryRow[] = [];
	const sortedTags = [...tagCounts.entries()].sort((a, b) => {
		if (b[1].count !== a[1].count) return b[1].count - a[1].count;
		return a[0].localeCompare(b[0]);
	});
	for (const [tag, entry] of sortedTags) {
		rows.push({
			count: entry.count,
			label: `<${tag}>`,
			suggestion: entry.suggestion.note
				? `${entry.suggestion.component} (${entry.suggestion.note})`
				: entry.suggestion.component,
			isExtra: false
		});
	}
	if (malformedCount > 0) {
		rows.push({
			count: malformedCount,
			label: 'malformed directive',
			suggestion: null,
			isExtra: true
		});
	}
	if (parseErrorCount > 0) {
		rows.push({ count: parseErrorCount, label: 'parse error', suggestion: null, isExtra: true });
	}
	if (readErrorCount > 0) {
		rows.push({ count: readErrorCount, label: 'read error', suggestion: null, isExtra: true });
	}
	return rows;
}

function formatReport(violations: Violation[], c: Colorizer): string {
	const lines: string[] = [];

	// Bucket by file.
	const byFile = new Map<string, Violation[]>();
	for (const v of violations) {
		const arr = byFile.get(v.file);
		if (arr) arr.push(v);
		else byFile.set(v.file, [v]);
	}

	const total = violations.length;
	const fileCount = byFile.size;
	const totalWord = total === 1 ? 'violation' : 'violations';
	const fileWord = fileCount === 1 ? 'file' : 'files';

	// ---- Header ----
	lines.push(
		`${c.bold(`${total} ${totalWord}`)} across ${c.bold(`${fileCount} ${fileWord}`)} ${c.dim(`(${RULE_NAME})`)}`
	);
	lines.push('');

	// ---- Summary table ----
	const rows = buildSummaryRows(violations);
	if (rows.length > 0) {
		const countWidth = Math.max(...rows.map((r) => String(r.count).length));
		const labelWidth = Math.max(...rows.map((r) => r.label.length));
		for (const row of rows) {
			const countStr = String(row.count).padStart(countWidth);
			const labelStr = row.label.padEnd(labelWidth);
			const coloredLabel = row.isExtra ? c.yellow(labelStr) : c.red(labelStr);
			const suggestionStr = row.suggestion ? `  ${c.cyan(row.suggestion)}` : '';
			lines.push(`  ${c.yellow(countStr)}  ${coloredLabel}${suggestionStr}`);
		}
		lines.push('');
	}

	// ---- Separator ----
	lines.push(c.dim('\u2500'.repeat(60)));
	lines.push('');

	// ---- Per-file groups ----
	// Sort files by violation count (desc), ties broken alphabetically.
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
			const coloredLabel = v.kind === 'raw-ui' ? c.red(labelRaw) : c.yellow(labelRaw);
			const detail = violationDetail(v, c);
			lines.push(`  ${c.dim(locStr)}  ${coloredLabel}  ${detail}`);
		}

		if (fi < fileEntries.length - 1) lines.push('');
	}

	return lines.join('\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
	const files = await collectSvelteFiles();
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
				message
			});
			continue;
		}

		if (!BANNED_SCAN_RE.test(source)) continue;
		all.push(...lintFile(file, source));
	}

	const c = shouldUseColor() ? ansiColor : noColor;

	if (all.length === 0) {
		console.log(`${c.green('\u2713')} no raw UI element violations ${c.dim(`(${RULE_NAME})`)}`);
		Deno.exit(0);
	}

	console.log(formatReport(all, c));
	Deno.exit(1);
}

if (import.meta.main) {
	await main();
}
