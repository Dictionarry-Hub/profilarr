/**
 * page-meta lint script
 *
 * Route pages must own their browser tab title through the shared PageMeta
 * component. This avoids stale titles when navigating from a page that set a
 * title to one that forgot to reset it.
 *
 * Scope: route `+page.svelte` files under `src/routes`.
 *
 * Required:
 *   <PageMeta title="Settings" />
 *
 * Raw <svelte:head> in route pages is disallowed. Page metadata should live
 * behind PageMeta so title handling stays consistent.
 *
 * Escape hatch:
 *   <!-- lint-disable page-meta -- reason goes here -->
 *
 * Usage:
 *   deno task lint:page-meta
 */

import { parse } from 'svelte/compiler';
import {
	buildLineOffsets,
	collectFiles,
	type Colorizer,
	offsetToLineCol,
	pickColorizer
} from './_lib.ts';

const RULE_NAME = 'page-meta';
const COMPONENT_NAME = 'PageMeta';
const SCOPE_ROOTS = ['src/routes'];
const PAGE_FILE_RE = /(?:^|\/)\+page\.svelte$/;
const DISABLE_RE = /<!--\s*lint-disable\s+page-meta(?:\s+--\s*([\s\S]*?))?\s*-->/;

interface BaseViolation {
	file: string;
	line: number;
	column: number;
}

interface MissingComponentViolation extends BaseViolation {
	kind: 'missing-component';
}

interface MissingTitleViolation extends BaseViolation {
	kind: 'missing-title';
}

interface RawTitleViolation extends BaseViolation {
	kind: 'raw-title';
}

interface RawHeadViolation extends BaseViolation {
	kind: 'raw-head';
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
	| MissingComponentViolation
	| MissingTitleViolation
	| RawTitleViolation
	| RawHeadViolation
	| MalformedDirectiveViolation
	| ParseErrorViolation
	| ReadErrorViolation;

interface TextNode {
	type: 'Text';
	start: number;
	end: number;
	data: string;
}

interface CommentNode {
	type: 'Comment';
	start: number;
	end: number;
	data: string;
}

interface AttributeNode {
	type: 'Attribute';
	start: number;
	end: number;
	name: string;
}

interface Fragment {
	type: 'Fragment';
	nodes: AnyNode[];
}

interface SvelteRoot {
	type: 'Root';
	fragment: Fragment;
}

interface ElementLike {
	type: string;
	start: number;
	end: number;
	name?: string;
	attributes?: AnyNode[];
	fragment?: Fragment;
	consequent?: Fragment;
	alternate?: Fragment | null;
	body?: Fragment;
	fallback?: Fragment | null;
	pending?: Fragment | null;
	then?: Fragment | null;
	catch?: Fragment | null;
}

// deno-lint-ignore no-explicit-any
type AnyNode = any;

interface ScanResult {
	hasPageMeta: boolean;
	pageMetaHasTitle: boolean;
	pageMetaOffset: number | null;
	rawHeadOffsets: number[];
	rawTitleOffsets: number[];
}

function collectPageFiles(): Promise<string[]> {
	return collectFiles({
		roots: SCOPE_ROOTS,
		acceptFile: (rel) => PAGE_FILE_RE.test(rel)
	});
}

function checkDisableDirective(
	source: string,
	offsets: number[],
	file: string
): Violation[] | null {
	const match = DISABLE_RE.exec(source);
	if (!match) return null;

	const reason = (match[1] ?? '').trim();
	if (reason !== '') return [];

	const { line, column } = offsetToLineCol(offsets, match.index);
	return [
		{
			kind: 'malformed-directive',
			file,
			line,
			column,
			reason: `directive must be: lint-disable ${RULE_NAME} -- <reason>`
		}
	];
}

function hasTitleAttribute(node: ElementLike): boolean {
	return (node.attributes ?? []).some(
		(attr) => attr?.type === 'Attribute' && (attr as AttributeNode).name === 'title'
	);
}

function walkFragment(nodes: AnyNode[], result: ScanResult): void {
	for (const node of nodes) {
		if (!node || typeof node.type !== 'string') continue;
		const el = node as ElementLike;

		switch (node.type) {
			case 'Component':
			case 'SvelteComponent': {
				if (el.name === COMPONENT_NAME) {
					result.hasPageMeta = true;
					result.pageMetaOffset ??= el.start;
					result.pageMetaHasTitle ||= hasTitleAttribute(el);
				}
				if (el.fragment?.nodes) walkFragment(el.fragment.nodes, result);
				break;
			}

			case 'TitleElement': {
				result.rawTitleOffsets.push(el.start);
				if (el.fragment?.nodes) walkFragment(el.fragment.nodes, result);
				break;
			}

			case 'SvelteHead': {
				result.rawHeadOffsets.push(el.start);
				break;
			}

			case 'RegularElement':
			case 'SlotElement':
			case 'SvelteElement':
			case 'SvelteBody':
			case 'SvelteBoundary':
			case 'SvelteDocument':
			case 'SvelteFragment':
			case 'SvelteSelf':
			case 'SvelteWindow': {
				if (el.fragment?.nodes) walkFragment(el.fragment.nodes, result);
				break;
			}

			case 'IfBlock': {
				if (el.consequent?.nodes) walkFragment(el.consequent.nodes, result);
				if (el.alternate?.nodes) walkFragment(el.alternate.nodes, result);
				break;
			}

			case 'EachBlock': {
				if (el.body?.nodes) walkFragment(el.body.nodes, result);
				if (el.fallback?.nodes) walkFragment(el.fallback.nodes, result);
				break;
			}

			case 'AwaitBlock': {
				if (el.pending?.nodes) walkFragment(el.pending.nodes, result);
				if (el.then?.nodes) walkFragment(el.then.nodes, result);
				if (el.catch?.nodes) walkFragment(el.catch.nodes, result);
				break;
			}

			case 'KeyBlock':
			case 'SnippetBlock': {
				if (el.fragment?.nodes) walkFragment(el.fragment.nodes, result);
				if (el.body?.nodes) walkFragment(el.body.nodes, result);
				break;
			}

			// Text, Comment, ExpressionTag, HtmlTag, ConstTag, DebugTag,
			// RenderTag, AttachTag: no descent needed.
			case 'Text':
			case 'Comment': {
				void (node as TextNode | CommentNode);
				break;
			}
		}
	}
}

function lintFile(file: string, source: string): Violation[] {
	const out: Violation[] = [];
	const offsets = buildLineOffsets(source);

	const disabled = checkDisableDirective(source, offsets, file);
	if (disabled) return disabled;

	let root: SvelteRoot;
	try {
		// deno-lint-ignore no-explicit-any
		root = parse(source, { modern: true, filename: file } as any) as SvelteRoot;
	} catch (err) {
		out.push({
			kind: 'parse-error',
			file,
			line: 1,
			column: 1,
			message: err instanceof Error ? err.message : String(err)
		});
		return out;
	}

	const scan: ScanResult = {
		hasPageMeta: false,
		pageMetaHasTitle: false,
		pageMetaOffset: null,
		rawHeadOffsets: [],
		rawTitleOffsets: []
	};

	if (root.fragment?.nodes) {
		walkFragment(root.fragment.nodes, scan);
	}

	if (!scan.hasPageMeta) {
		out.push({ kind: 'missing-component', file, line: 1, column: 1 });
	} else if (!scan.pageMetaHasTitle) {
		const offset = scan.pageMetaOffset ?? 0;
		const { line, column } = offsetToLineCol(offsets, offset);
		out.push({ kind: 'missing-title', file, line, column });
	}
	for (const offset of scan.rawHeadOffsets) {
		const { line, column } = offsetToLineCol(offsets, offset);
		out.push({ kind: 'raw-head', file, line, column });
	}
	for (const offset of scan.rawTitleOffsets) {
		const { line, column } = offsetToLineCol(offsets, offset);
		out.push({ kind: 'raw-title', file, line, column });
	}

	return out;
}

function violationLabel(v: Violation): string {
	switch (v.kind) {
		case 'missing-component':
			return 'missing PageMeta';
		case 'missing-title':
			return 'missing title prop';
		case 'raw-head':
			return 'raw <svelte:head>';
		case 'raw-title':
			return 'raw <title>';
		case 'malformed-directive':
			return 'malformed directive';
		case 'parse-error':
			return 'parse error';
		case 'read-error':
			return 'read error';
	}
}

function violationDetail(v: Violation, c: Colorizer): string {
	const arrow = c.dim('\u2192');
	switch (v.kind) {
		case 'missing-component':
			return `${arrow} render ${c.cyan(`<${COMPONENT_NAME} title="..." />`)}`;
		case 'missing-title':
			return `${arrow} pass a short page title`;
		case 'raw-head':
			return `${arrow} use ${c.cyan(`<${COMPONENT_NAME} title="..." />`)} instead`;
		case 'raw-title':
			return `${arrow} use ${c.cyan(`<${COMPONENT_NAME} title="..." />`)} instead`;
		case 'malformed-directive':
			return c.dim(v.reason);
		case 'parse-error':
		case 'read-error':
			return c.dim(v.message);
	}
}

function formatReport(violations: Violation[], c: Colorizer): string {
	const lines: string[] = [];
	lines.push(c.red(`${violations.length} page-meta violation(s) found`));
	lines.push('');

	for (const v of violations) {
		lines.push(
			`${c.bold(v.file)}:${v.line}:${v.column}  ${c.red(violationLabel(v))} ${violationDetail(v, c)}`
		);
	}

	lines.push('');
	lines.push(c.bold('Rule:'));
	lines.push(`  Route pages must render ${c.cyan(`<${COMPONENT_NAME} title="..." />`)}.`);
	lines.push(`  Raw ${c.cyan('<svelte:head>')} in route pages is not allowed.`);
	lines.push('');
	lines.push(c.bold('Escape hatch:'));
	lines.push(`  ${c.dim(`<!-- lint-disable ${RULE_NAME} -- reason goes here -->`)}`);

	return lines.join('\n');
}

async function main() {
	const files = await collectPageFiles();
	const violations: Violation[] = [];

	for (const file of files) {
		try {
			const source = await Deno.readTextFile(file);
			violations.push(...lintFile(file, source));
		} catch (err) {
			violations.push({
				kind: 'read-error',
				file,
				line: 1,
				column: 1,
				message: err instanceof Error ? err.message : String(err)
			});
		}
	}

	if (violations.length > 0) {
		console.error(formatReport(violations, pickColorizer()));
		Deno.exit(1);
	}

	console.log('page-meta lint passed');
}

if (import.meta.main) {
	await main();
}
