/**
 * no-hardcoded-theme Svelte lint script
 *
 * Enforces the convention that UI code uses semantic theme tokens rather than
 * hardcoded Tailwind color, radius, and shadow classes.
 *
 * Scope: `.svelte` files under `src/routes/` and `src/lib/client/`, excluding
 * `src/lib/client/ui/help/characters/` (character components use intentional
 * hardcoded colors for their themed visuals).
 *
 * What gets flagged:
 *   - Hardcoded color utilities: bg-gray-800, text-white, border-zinc-700, etc.
 *   - Arbitrary color values: bg-[#1a1714], text-[rgb(...)], etc.
 *   - dark: variants of color utilities (semantic tokens handle dark mode)
 *   - Hardcoded radius: rounded, rounded-lg, rounded-xl, rounded-full, etc.
 *   - Hardcoded shadows: shadow, shadow-md, shadow-lg, etc.
 *
 * What is allowed:
 *   - Semantic tokens: bg-surface, text-text, border-border, rounded-control, etc.
 *   - Accent palette: bg-accent-500, text-accent-600, etc.
 *   - Non-theme utilities: p-4, mt-2, flex, gap-3, text-sm, font-bold, etc.
 *   - Resets: rounded-none, shadow-none
 *   - Special values: transparent, inherit, current
 *
 * Escape hatch: an HTML comment on the preceding line:
 *
 *     <!-- lint-disable-next-line no-hardcoded-theme -- reason goes here -->
 *     <div class="bg-gray-800">
 *
 * Usage:
 *   deno task lint:theme
 */

import { collectFiles, type Colorizer, pickColorizer } from './_lib.ts';

// ============================================================================
// CONFIGURATION
// ============================================================================

const RULE_NAME = 'no-hardcoded-theme';

const SCOPE_ROOTS = ['src/routes', 'src/lib/client'];
const EXCLUDED_PREFIXES = ['src/lib/client/ui/help/characters/'];

// ============================================================================
// BANNED PATTERNS
// ============================================================================

const COLOR_PREFIXES = [
	'bg',
	'text',
	'border',
	'ring',
	'outline',
	'divide',
	'from',
	'to',
	'via',
	'fill',
	'stroke',
	'decoration',
	'caret',
	'placeholder'
];

const TAILWIND_PALETTES = [
	'slate',
	'gray',
	'zinc',
	'neutral',
	'stone',
	'red',
	'orange',
	'amber',
	'yellow',
	'lime',
	'green',
	'emerald',
	'teal',
	'cyan',
	'sky',
	'blue',
	'indigo',
	'violet',
	'purple',
	'fuchsia',
	'pink',
	'rose'
];

const HARDCODED_SINGLES = ['white', 'black'];

// Semantic tokens that ARE allowed
const ALLOWED_COLOR_SUFFIXES = new Set([
	'app',
	'surface',
	'surface-muted',
	'surface-hover',
	'surface-hover-muted',
	'text',
	'text-soft',
	'text-muted',
	'text-subtle',
	'border',
	'border-muted',
	'border-subtle',
	'accent-solid',
	'accent-solid-hover',
	'on-accent',
	'danger-solid',
	'danger-solid-hover',
	'on-danger',
	'success-bg',
	'success-text',
	'success-border',
	'success-icon',
	'warning-bg',
	'warning-text',
	'warning-border',
	'warning-icon',
	'danger-bg',
	'danger-text',
	'danger-border',
	'danger-icon',
	'info-bg',
	'info-text',
	'info-border',
	'info-icon',
	'link-text',
	'overlay',
	'transparent',
	'inherit',
	'current'
]);

// text-* that are NOT colors (sizes, alignment, wrapping, etc.)
const TEXT_NON_COLOR = new Set([
	'xs',
	'sm',
	'base',
	'lg',
	'xl',
	'2xl',
	'3xl',
	'4xl',
	'5xl',
	'6xl',
	'7xl',
	'8xl',
	'9xl',
	'left',
	'center',
	'right',
	'justify',
	'start',
	'end',
	'wrap',
	'nowrap',
	'pretty',
	'balance',
	'ellipsis',
	'clip',
	'truncate'
]);

// Allowed radius classes
const ALLOWED_RADIUS = new Set([
	'rounded-none',
	'rounded-control-sm',
	'rounded-control',
	'rounded-card',
	'rounded-pill',
	'rounded-t-control-sm',
	'rounded-b-control-sm',
	'rounded-l-control-sm',
	'rounded-r-control-sm',
	'rounded-t-control',
	'rounded-b-control',
	'rounded-l-control',
	'rounded-r-control',
	'rounded-t-card',
	'rounded-b-card',
	'rounded-l-card',
	'rounded-r-card',
	'rounded-tl-control-sm',
	'rounded-tr-control-sm',
	'rounded-bl-control-sm',
	'rounded-br-control-sm',
	'rounded-tl-control',
	'rounded-tr-control',
	'rounded-bl-control',
	'rounded-br-control',
	'rounded-tl-card',
	'rounded-tr-card',
	'rounded-bl-card',
	'rounded-br-card',
	'rounded-t-none',
	'rounded-b-none',
	'rounded-l-none',
	'rounded-r-none',
	'rounded-tl-none',
	'rounded-tr-none',
	'rounded-bl-none',
	'rounded-br-none'
]);

// Allowed shadow classes
const ALLOWED_SHADOW = new Set([
	'shadow-none',
	'shadow-card',
	'shadow-control',
	'shadow-control-active'
]);

// ============================================================================
// TYPES
// ============================================================================

type ViolationKind =
	| 'hardcoded-color'
	| 'dark-color-variant'
	| 'hardcoded-radius'
	| 'hardcoded-shadow';

interface Violation {
	file: string;
	line: number;
	kind: ViolationKind;
	token: string;
	suggestion: string;
}

const SUGGESTIONS: Record<ViolationKind, string> = {
	'hardcoded-color': 'bg-surface, text-text, border-border, bg-accent-solid, etc.',
	'dark-color-variant': 'semantic tokens handle dark mode automatically',
	'hardcoded-radius': 'rounded-control-sm, rounded-control, rounded-card, rounded-pill',
	'hardcoded-shadow': 'shadow-card, shadow-control, shadow-control-active'
};

// ============================================================================
// CLASS TOKEN CHECKING
// ============================================================================

function stripVariants(token: string): string {
	const parts = token.split(':');
	return parts[parts.length - 1];
}

function hasVariant(token: string, variant: string): boolean {
	return token.split(':').includes(variant);
}

function isHardcodedColor(base: string): boolean {
	for (const prefix of COLOR_PREFIXES) {
		if (!base.startsWith(prefix + '-')) continue;
		const suffix = base.slice(prefix.length + 1);

		// Check if it's an allowed semantic token
		if (ALLOWED_COLOR_SUFFIXES.has(suffix)) return false;

		// Check if it's an accent palette reference (accent-50 through accent-950)
		if (/^accent-\d+$/.test(suffix)) return false;

		// text-* has non-color uses
		if (prefix === 'text' && TEXT_NON_COLOR.has(suffix)) return false;

		// Check hardcoded palette: bg-gray-500, text-red-200, etc.
		for (const palette of TAILWIND_PALETTES) {
			if (suffix === palette || suffix.startsWith(palette + '-')) return true;
		}

		// Check white/black
		for (const single of HARDCODED_SINGLES) {
			if (suffix === single || suffix.startsWith(single + '/')) return true;
		}

		// Check arbitrary color values: bg-[#...], text-[rgb(...)], etc.
		if (suffix.startsWith('[')) {
			const inner = suffix.slice(1).toLowerCase();
			if (
				inner.startsWith('#') ||
				inner.startsWith('rgb') ||
				inner.startsWith('hsl') ||
				inner.startsWith('oklch') ||
				inner.startsWith('color')
			) {
				return true;
			}
		}
	}
	return false;
}

function isHardcodedRadius(base: string): boolean {
	if (!base.startsWith('rounded')) return false;
	if (ALLOWED_RADIUS.has(base)) return false;
	// Match: rounded, rounded-sm, rounded-md, rounded-lg, rounded-xl,
	// rounded-2xl, rounded-3xl, rounded-full, rounded-t-lg, rounded-[8px], etc.
	if (/^rounded(-[a-z0-9[\]]+)*$/.test(base)) return true;
	return false;
}

function isHardcodedShadow(base: string): boolean {
	if (!base.startsWith('shadow')) return false;
	if (ALLOWED_SHADOW.has(base)) return false;
	// Match: shadow, shadow-sm, shadow-md, shadow-lg, shadow-xl,
	// shadow-2xl, shadow-inner, shadow-[...], etc.
	// But NOT shadow-card, shadow-control (already allowed above)
	if (/^shadow(-[a-z0-9[\]]+)*$/.test(base)) return true;
	return false;
}

function classifyToken(token: string): ViolationKind | null {
	const base = stripVariants(token);

	// Check dark: variant on color utilities
	if (hasVariant(token, 'dark') && isColorUtility(base)) {
		return 'dark-color-variant';
	}

	if (isHardcodedColor(base)) return 'hardcoded-color';
	if (isHardcodedRadius(base)) return 'hardcoded-radius';
	if (isHardcodedShadow(base)) return 'hardcoded-shadow';

	return null;
}

function isColorUtility(base: string): boolean {
	for (const prefix of COLOR_PREFIXES) {
		if (base.startsWith(prefix + '-')) return true;
	}
	return false;
}

// ============================================================================
// FILE SCANNING
// ============================================================================

function stripStyleBlocks(source: string): string {
	return source.replace(/<style[\s>][\s\S]*?<\/style>/gi, (match) => {
		// Replace with same number of newlines to preserve line numbers
		return match.replace(/[^\n]/g, ' ');
	});
}

function stripHtmlComments(line: string): string {
	return line.replace(/<!--[\s\S]*?-->/g, (match) => ' '.repeat(match.length));
}

// Regex to find potential Tailwind class tokens
// Matches word-like sequences with hyphens, colons, slashes, and brackets
const TOKEN_RE = /(?:[\w-]+:)*[\w-]+(?:\[[^\]]*\])?(?:\/[\w.]+)?/g;

function isDisableLine(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed.startsWith('<!--')) return false;
	const match = /<!--\s*lint-disable-next-line\s+(\S+)\s+--\s*(.+?)\s*-->/.exec(trimmed);
	if (!match) return false;
	return match[1] === RULE_NAME && match[2].trim().length > 0;
}

function lintFile(file: string, source: string): Violation[] {
	const violations: Violation[] = [];
	const stripped = stripStyleBlocks(source);
	const lines = stripped.split('\n');

	for (let i = 0; i < lines.length; i++) {
		// Check if previous line has a disable comment
		if (i > 0 && isDisableLine(lines[i - 1])) continue;

		const line = stripHtmlComments(lines[i]);
		let match: RegExpExecArray | null;
		TOKEN_RE.lastIndex = 0;

		while ((match = TOKEN_RE.exec(line)) !== null) {
			const token = match[0];
			const kind = classifyToken(token);
			if (kind) {
				violations.push({
					file,
					line: i + 1,
					kind,
					token,
					suggestion: SUGGESTIONS[kind]
				});
			}
		}
	}

	return violations;
}

// ============================================================================
// FILE DISCOVERY
// ============================================================================

type Scope = 'all' | 'routes' | 'ui';

function rootsForScope(scope: Scope): string[] {
	switch (scope) {
		case 'routes':
			return ['src/routes'];
		case 'ui':
			return ['src/lib/client'];
		case 'all':
			return SCOPE_ROOTS;
	}
}

function collectSvelteFiles(scope: Scope): Promise<string[]> {
	return collectFiles({
		roots: rootsForScope(scope),
		acceptFile: (rel) => {
			if (!rel.endsWith('.svelte')) return false;
			for (const prefix of EXCLUDED_PREFIXES) {
				if (rel.startsWith(prefix)) return false;
			}
			return true;
		}
	});
}

function parseScope(args: string[]): Scope {
	const arg = args[0]?.toLowerCase();
	if (arg === 'routes') return 'routes';
	if (arg === 'ui') return 'ui';
	return 'all';
}

// ============================================================================
// REPORT FORMATTER
// ============================================================================

function kindLabel(kind: ViolationKind): string {
	switch (kind) {
		case 'hardcoded-color':
			return 'color';
		case 'dark-color-variant':
			return 'dark:';
		case 'hardcoded-radius':
			return 'radius';
		case 'hardcoded-shadow':
			return 'shadow';
	}
}

function formatReport(violations: Violation[], c: Colorizer): string {
	const lines: string[] = [];

	// Bucket by file
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

	// Summary by kind
	const kindCounts = new Map<ViolationKind, number>();
	for (const v of violations) {
		kindCounts.set(v.kind, (kindCounts.get(v.kind) ?? 0) + 1);
	}
	const countWidth = Math.max(...[...kindCounts.values()].map((n) => String(n).length));
	for (const [kind, count] of [...kindCounts.entries()].sort((a, b) => b[1] - a[1])) {
		const countStr = String(count).padStart(countWidth);
		const label = kindLabel(kind);
		lines.push(`  ${c.yellow(countStr)}  ${c.red(label.padEnd(8))}  ${c.cyan(SUGGESTIONS[kind])}`);
	}
	lines.push('');

	// Separator
	lines.push(c.dim('─'.repeat(60)));
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

		const maxLineWidth = Math.max(...sorted.map((v) => String(v.line).length));
		const maxKindWidth = Math.max(...sorted.map((v) => kindLabel(v.kind).length));

		for (const v of sorted) {
			const lineStr = String(v.line).padStart(maxLineWidth);
			const label = kindLabel(v.kind).padEnd(maxKindWidth);
			lines.push(`  ${c.dim(lineStr)}  ${c.red(label)}  ${c.yellow(v.token)}`);
		}

		if (fi < fileEntries.length - 1) lines.push('');
	}

	return lines.join('\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
	const scope = parseScope(Deno.args);
	const files = await collectSvelteFiles(scope);
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
		console.log(`${c.green('✓')} no hardcoded theme violations ${c.dim(`(${RULE_NAME})`)}`);
		Deno.exit(0);
	}

	console.log(formatReport(all, c));
	Deno.exit(1);
}

if (import.meta.main) {
	await main();
}
