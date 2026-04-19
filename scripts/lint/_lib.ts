/**
 * Shared helpers for the custom lint scripts under `scripts/lint/`.
 *
 * Each rule is its own `*.ts` script (so it can be invoked individually) but
 * they all share the same plumbing: walk a set of source roots, compute
 * line/column from byte offsets, classify `lint-disable-next-line` directive
 * comments, and emit colored output that respects NO_COLOR / FORCE_COLOR.
 *
 * Rule-specific concerns (what to detect, how to suggest a fix, the report
 * layout) live in the rule's own script.
 */

// ============================================================================
// FILE WALK
// ============================================================================

export interface WalkOptions {
	/** Source roots to recursively walk (e.g. `['src/routes', 'src/lib/client']`). */
	roots: string[];
	/** Directory names to skip during the walk. */
	skipDirs?: Set<string>;
	/**
	 * Called for every regular file under `roots` with the file's normalized
	 * relative path (forward slashes, even on Windows). Return `true` to
	 * include the file in the result list.
	 */
	acceptFile: (relPath: string) => boolean;
}

const DEFAULT_SKIP_DIRS = new Set(['.svelte-kit', 'node_modules']);

export async function collectFiles(opts: WalkOptions): Promise<string[]> {
	const skip = opts.skipDirs ?? DEFAULT_SKIP_DIRS;
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
			if (skip.has(entry.name)) continue;
			const rel = `${dir}/${entry.name}`;
			if (entry.isDirectory) {
				await walk(rel);
			} else if (entry.isFile) {
				const norm = rel.replaceAll('\\', '/');
				if (opts.acceptFile(norm)) out.push(norm);
			}
		}
	}

	for (const root of opts.roots) {
		await walk(root);
	}

	out.sort();
	return out;
}

// ============================================================================
// POSITION HELPERS
// ============================================================================

export function buildLineOffsets(source: string): number[] {
	const offsets = [0];
	for (let i = 0; i < source.length; i++) {
		if (source.charCodeAt(i) === 10 /* \n */) {
			offsets.push(i + 1);
		}
	}
	return offsets;
}

export function offsetToLineCol(
	offsets: number[],
	offset: number
): { line: number; column: number } {
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
// DIRECTIVE CLASSIFIER
//
// Format: `lint-disable-next-line <rule-name> -- <non-empty reason>`
// The leading comment markers (`<!--` or `//`) are stripped by the caller;
// `data` is the comment body.
// ============================================================================

export type CommentStatus =
	| { kind: 'none' }
	| { kind: 'valid'; reason: string }
	| { kind: 'malformed'; reason: string };

export function classifyDirective(data: string, ruleName: string): CommentStatus {
	const trimmed = data.trim();
	if (!/^lint-disable-next-line\b/.test(trimmed)) {
		return { kind: 'none' };
	}
	const m = /^lint-disable-next-line\s+(\S+)(?:\s+--\s*(.*))?$/.exec(trimmed);
	if (!m) {
		return {
			kind: 'malformed',
			reason: `directive must be: lint-disable-next-line ${ruleName} -- <reason>`
		};
	}
	const [, name, rawReason] = m;
	if (name !== ruleName) {
		return {
			kind: 'malformed',
			reason: `unknown rule "${name}", expected "${ruleName}"`
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
// COLOR
// ============================================================================

export interface Colorizer {
	bold: (s: string) => string;
	dim: (s: string) => string;
	red: (s: string) => string;
	green: (s: string) => string;
	yellow: (s: string) => string;
	cyan: (s: string) => string;
}

export const ansiColor: Colorizer = {
	bold: (s) => `\x1b[1m${s}\x1b[22m`,
	dim: (s) => `\x1b[2m${s}\x1b[22m`,
	red: (s) => `\x1b[31m${s}\x1b[39m`,
	green: (s) => `\x1b[32m${s}\x1b[39m`,
	yellow: (s) => `\x1b[33m${s}\x1b[39m`,
	cyan: (s) => `\x1b[36m${s}\x1b[39m`
};

export const noColor: Colorizer = {
	bold: (s) => s,
	dim: (s) => s,
	red: (s) => s,
	green: (s) => s,
	yellow: (s) => s,
	cyan: (s) => s
};

// https://no-color.org/ and https://force-color.org/
export function shouldUseColor(): boolean {
	if (Deno.env.get('NO_COLOR') !== undefined) return false;
	const force = Deno.env.get('FORCE_COLOR');
	if (force !== undefined && force !== '0' && force !== 'false') return true;
	try {
		return Deno.stdout.isTerminal();
	} catch {
		return false;
	}
}

export function pickColorizer(): Colorizer {
	return shouldUseColor() ? ansiColor : noColor;
}
