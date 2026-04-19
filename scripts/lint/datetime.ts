/**
 * no-raw-dates lint script
 *
 * Two scopes:
 *
 * 1. Query layer (src/lib/server/db/queries/*.ts): timestamp columns (fields
 *    ending in `_at`) must be wrapped in `toUTC()` when mapped to return
 *    values. A bare `createdAt: row.created_at` is a violation.
 *
 * 2. Svelte files (src/routes/ *.svelte): raw locale date methods and raw
 *    `new Date(x)` for display are banned. Use the display functions from
 *    `$shared/utils/dates` instead.
 *
 * Escape hatch (Svelte only):
 *
 *     <!-- lint-disable-next-line no-raw-dates -- reason -->
 *
 * Usage:
 *   deno task lint:datetime
 */

import { collectFiles, type Colorizer, pickColorizer } from './_lib.ts';

// ============================================================================
// CONFIGURATION
// ============================================================================

const RULE_NAME = 'no-raw-dates';

// ============================================================================
// TYPES
// ============================================================================

interface Violation {
	file: string;
	line: number;
	column: number;
	kind: 'bare-timestamp' | 'raw-locale' | 'raw-date-display' | 'read-error';
	message: string;
	suggestion?: string;
}

// ============================================================================
// QUERY LAYER LINT
// ============================================================================

// Matches lines like `somethingAt: row.something_at` without toUTC() wrapping.
// Captures the property name and the row field for the error message.
const BARE_TIMESTAMP_RE = /(\w+(?:At|_at))\s*:\s*(?:row|r)\.(\w+_at)\b(?!.*toUTC)/;

// Lines that are comments or contain toUTC already are safe.
const COMMENT_LINE_RE = /^\s*(?:\/\/|\/\*|\*)/;

async function lintQueryFiles(): Promise<Violation[]> {
	const files = await collectFiles({
		roots: ['src/lib/server/db/queries'],
		acceptFile: (rel) => rel.endsWith('.ts')
	});

	const violations: Violation[] = [];

	for (const file of files) {
		let source: string;
		try {
			source = await Deno.readTextFile(file);
		} catch (err) {
			violations.push({
				file,
				line: 1,
				column: 1,
				kind: 'read-error',
				message: err instanceof Error ? err.message : String(err)
			});
			continue;
		}

		const lines = source.split('\n');
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (COMMENT_LINE_RE.test(line)) continue;

			const match = BARE_TIMESTAMP_RE.exec(line);
			if (match) {
				violations.push({
					file,
					line: i + 1,
					column: match.index + 1,
					kind: 'bare-timestamp',
					message: `${match[1]}: ${match[2]} not wrapped in toUTC()`,
					suggestion: `${match[1]}: toUTC(${match[2]})`
				});
			}
		}
	}

	return violations;
}

// ============================================================================
// SVELTE FILE LINT
// ============================================================================

// Patterns that indicate raw locale date usage.
// Only flag .toLocaleString() when called on a Date (not on a number).
// .toLocaleDateString() and .toLocaleTimeString() are always date methods.
const RAW_LOCALE_DATE_ONLY_RE = /\.toLocaleDateString\(|\.toLocaleTimeString\(/;
// .toLocaleString() is ambiguous (numbers also have it).
// Flag when: (a) called on a Date-like expression, OR (b) called with
// Intl date formatting options (month, day, year, hour, etc.).
const RAW_TOLOCALESTRING_RE =
	/(?:new Date\([^)]*\)|(?<!\w)(?:date|d|parsed)\)?)\s*\.toLocaleString\(|\.toLocaleString\(\s*(?:undefined|'[^']*')\s*,\s*\{[^}]*(?:month|day|year|hour|minute|second)/i;

// Pattern for `new Date(something)` used directly in template expressions.
// Matches things like `{new Date(row.timestamp)}` or `${new Date(x).toLocale`
const RAW_DATE_DISPLAY_RE = /\bnew Date\([^)]+\)\s*\}/;

// Escape hatch comment pattern.
const DISABLE_RE = /<!--\s*lint-disable-next-line\s+no-raw-dates\s+--\s*.+?-->/;

const SCRIPT_OPEN_RE = /^<script\b/;
const SCRIPT_CLOSE_RE = /^<\/script>/;

const SUGGESTION_SCRIPT = 'use formatDateTime() or formatDate() from $shared/utils/dates';
const SUGGESTION_TEMPLATE = 'use <DateTime value={...} /> from $ui/datetime/DateTime.svelte';

async function lintSvelteFiles(): Promise<Violation[]> {
	const files = await collectFiles({
		roots: ['src/routes'],
		acceptFile: (rel) => rel.endsWith('.svelte')
	});

	const violations: Violation[] = [];

	for (const file of files) {
		let source: string;
		try {
			source = await Deno.readTextFile(file);
		} catch (err) {
			violations.push({
				file,
				line: 1,
				column: 1,
				kind: 'read-error',
				message: err instanceof Error ? err.message : String(err)
			});
			continue;
		}

		const lines = source.split('\n');
		let inScript = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trimStart();

			if (SCRIPT_OPEN_RE.test(trimmed)) {
				inScript = true;
				continue;
			}
			if (SCRIPT_CLOSE_RE.test(trimmed)) {
				inScript = false;
				continue;
			}

			// Check for escape hatch on previous line.
			if (i > 0 && DISABLE_RE.test(lines[i - 1])) continue;

			const suggestion = inScript ? SUGGESTION_SCRIPT : SUGGESTION_TEMPLATE;

			// Check for .toLocaleDateString() / .toLocaleTimeString() (always date)
			const dateOnlyMatch = RAW_LOCALE_DATE_ONLY_RE.exec(line);
			if (dateOnlyMatch) {
				violations.push({
					file,
					line: i + 1,
					column: dateOnlyMatch.index + 1,
					kind: 'raw-locale',
					message: 'raw locale date method',
					suggestion
				});
			}

			// Check for .toLocaleString() only when it looks like a date call
			if (!dateOnlyMatch) {
				const toLocaleMatch = RAW_TOLOCALESTRING_RE.exec(line);
				if (toLocaleMatch) {
					violations.push({
						file,
						line: i + 1,
						column: toLocaleMatch.index + 1,
						kind: 'raw-locale',
						message: 'raw locale date method',
						suggestion
					});
				}
			}

			const dateMatch = RAW_DATE_DISPLAY_RE.exec(line);
			if (dateMatch) {
				violations.push({
					file,
					line: i + 1,
					column: dateMatch.index + 1,
					kind: 'raw-date-display',
					message: 'raw new Date() in template',
					suggestion
				});
			}
		}
	}

	return violations;
}

// ============================================================================
// REPORT FORMATTER
// ============================================================================

function formatReport(violations: Violation[], c: Colorizer): string {
	const lines: string[] = [];

	const byFile = new Map<string, Violation[]>();
	for (const v of violations) {
		const arr = byFile.get(v.file);
		if (arr) arr.push(v);
		else byFile.set(v.file, [v]);
	}

	const total = violations.length;
	const fileCount = byFile.size;

	// Header
	lines.push(
		`${c.bold(`${total} ${total === 1 ? 'violation' : 'violations'}`)} across ${c.bold(`${fileCount} ${fileCount === 1 ? 'file' : 'files'}`)} ${c.dim(`(${RULE_NAME})`)}`
	);
	lines.push('');

	// Summary counts by kind
	const kindCounts = new Map<string, number>();
	for (const v of violations) {
		kindCounts.set(v.kind, (kindCounts.get(v.kind) ?? 0) + 1);
	}
	for (const [kind, count] of kindCounts) {
		lines.push(`  ${c.yellow(String(count).padStart(4))}  ${c.red(kind)}`);
	}
	lines.push('');

	// Separator
	lines.push(c.dim('\u2500'.repeat(60)));
	lines.push('');

	// Per-file groups
	const fileEntries = [...byFile.entries()].sort((a, b) => {
		if (b[1].length !== a[1].length) return b[1].length - a[1].length;
		return a[0].localeCompare(b[0]);
	});

	for (let fi = 0; fi < fileEntries.length; fi++) {
		const [file, fileViolations] = fileEntries[fi];
		const sorted = [...fileViolations].sort((a, b) => a.line - b.line);

		lines.push(`${c.bold(file)} ${c.dim(`(${fileViolations.length})`)}`);

		const maxLocWidth = Math.max(...sorted.map((v) => `${v.line}:${v.column}`.length));

		for (const v of sorted) {
			const locStr = `${v.line}:${v.column}`.padStart(maxLocWidth);
			const arrow = v.suggestion ? `  ${c.dim('\u2192')} ${c.cyan(v.suggestion)}` : '';
			lines.push(`  ${c.dim(locStr)}  ${c.red(v.message)}${arrow}`);
		}

		if (fi < fileEntries.length - 1) lines.push('');
	}

	return lines.join('\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
	const queryViolations = await lintQueryFiles();
	const svelteViolations = await lintSvelteFiles();
	const all = [...queryViolations, ...svelteViolations];

	const c = pickColorizer();

	if (all.length === 0) {
		console.log(`${c.green('\u2713')} no datetime violations ${c.dim(`(${RULE_NAME})`)}`);
		Deno.exit(0);
	}

	console.log(formatReport(all, c));
	Deno.exit(1);
}

if (import.meta.main) {
	await main();
}
