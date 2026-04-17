/**
 * Vibe coded Profilarr code statistics.
 *
 * Reports three sections:
 *
 *   1. LANGUAGE BREAKDOWN - files, code, lines, % of code per language
 *   2. MODULE BREAKDOWN   - grouped by server/client/shared/routes/services/app,
 *                           with a Test LOC and T:S (test-to-source) column
 *   3. SUMMARY            - totals for files, code, comments, blanks
 *
 * Modules are discovered two ways. Documented modules come from architecture
 * docs under docs/backend/ and docs/frontend/: any line of the form
 *
 *     **Source:** `src/path/`
 *
 * is parsed; backticked tokens that begin with `src/` become the module's
 * source paths. Every source file not claimed by a documented module is
 * placed in an auto-discovered "extra" module, keyed by its namespace child
 * (e.g. src/routes/custom-formats/... -> routes/custom-formats). Extras are
 * rendered with a leading `*` marker. Nothing hides.
 *
 * The line counter is native: no external dependency. Rules by language:
 *
 *     ts/tsx/js/jsx/cs : line "//",  block "/*","* /"
 *     css/scss         :              block "/*","* /"
 *     sql              : line "--",  block "/*","* /"
 *     html             :              block "<!--","-->"
 *     svelte           : section-aware dispatcher (template -> script -> style)
 *
 * Totals are a derived view computed once at render time, never an
 * accumulator. Branded types keep absolute and relative paths from
 * cross-assigning. IO lives only at the edges (doc walk, source walk, tests
 * walk, stdout write); the middle of the pipeline is pure functions.
 *
 * Usage:
 *     deno task stats
 *     DEBUG=1 deno task stats     # per-stage timing to stderr
 */

// ============================================================================
// TYPES
// ============================================================================

type AbsPath = string & { readonly __brand: 'abs' };
type RelPath = string & { readonly __brand: 'rel' };
type ModuleId = string & { readonly __brand: 'moduleId' };

type Language = 'TypeScript' | 'JavaScript' | 'Svelte' | 'CSS' | 'SCSS' | 'HTML' | 'SQL' | 'C#';

type Group = 'server' | 'client' | 'shared' | 'lib' | 'routes' | 'services' | 'app';

interface CommentRule {
	readonly line: string | null;
	readonly blockStart: string | null;
	readonly blockEnd: string | null;
}

interface Counts {
	readonly code: number;
	readonly comment: number;
	readonly blank: number;
}

type FileCount =
	| {
			readonly ok: true;
			readonly path: AbsPath;
			readonly language: Language;
			readonly counts: Counts;
	  }
	| { readonly ok: false; readonly path: AbsPath; readonly message: string };

interface DocumentedModule {
	readonly kind: 'documented';
	readonly id: ModuleId;
	readonly group: Group;
	readonly basename: string;
	readonly doc: RelPath;
	readonly sources: readonly AbsPath[];
}

interface ExtraModule {
	readonly kind: 'extra';
	readonly id: ModuleId;
	readonly group: Group;
	readonly basename: string;
}

type Module = DocumentedModule | ExtraModule;

interface ModuleStats {
	readonly module: Module;
	readonly files: number;
	readonly counts: Counts;
	readonly testLoc: number | null;
}

interface LanguageStats {
	readonly language: Language;
	readonly files: number;
	readonly counts: Counts;
}

interface Aggregated {
	readonly modules: readonly ModuleStats[];
	readonly languages: readonly LanguageStats[];
	readonly testsTotal: number;
	readonly errors: readonly { readonly path: AbsPath; readonly message: string }[];
}

// Injected so the pure stages can be tested against an in-memory filesystem.
interface Fs {
	readonly readTextFile: (path: string) => Promise<string>;
	readonly readDir: (path: string) => AsyncIterable<Deno.DirEntry>;
	readonly stat: (path: string) => Promise<Deno.FileInfo>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EXTENSIONS: ReadonlySet<string> = new Set([
	'ts',
	'tsx',
	'js',
	'jsx',
	'svelte',
	'css',
	'scss',
	'html',
	'sql',
	'cs'
]);

const LANGUAGE_BY_EXT = {
	ts: 'TypeScript',
	tsx: 'TypeScript',
	js: 'JavaScript',
	jsx: 'JavaScript',
	svelte: 'Svelte',
	css: 'CSS',
	scss: 'SCSS',
	html: 'HTML',
	sql: 'SQL',
	cs: 'C#'
} as const satisfies Record<string, Language>;

// Comment rules by language. Svelte has no entry because it dispatches per
// section (see countSvelte).
const COMMENT_RULES = {
	TypeScript: { line: '//', blockStart: '/*', blockEnd: '*/' },
	JavaScript: { line: '//', blockStart: '/*', blockEnd: '*/' },
	'C#': { line: '//', blockStart: '/*', blockEnd: '*/' },
	CSS: { line: null, blockStart: '/*', blockEnd: '*/' },
	SCSS: { line: null, blockStart: '/*', blockEnd: '*/' },
	SQL: { line: '--', blockStart: '/*', blockEnd: '*/' },
	HTML: { line: null, blockStart: '<!--', blockEnd: '-->' }
} as const satisfies Partial<Record<Language, CommentRule>>;

const SKIP_DIRS: ReadonlySet<string> = new Set([
	'.git',
	'node_modules',
	'.svelte-kit',
	'dist',
	// .NET build artifacts inside src/services/parser
	'bin',
	'obj'
]);

// Namespace containers. A file under one of these prefixes is assigned to the
// next path segment. Order matters: more specific prefixes come first so
// `src/lib/server/` wins over the fallback `src/lib/`.
const NAMESPACE_CONTAINERS: readonly { readonly prefix: string; readonly group: Group }[] = [
	{ prefix: 'src/lib/server/', group: 'server' },
	{ prefix: 'src/lib/client/', group: 'client' },
	{ prefix: 'src/lib/shared/', group: 'shared' },
	{ prefix: 'src/routes/', group: 'routes' },
	{ prefix: 'src/services/', group: 'services' },
	{ prefix: 'src/lib/', group: 'lib' }
];

// Order used for rendering module groups. Also the priority order for
// resolving basename collisions when attributing test LOC.
const GROUP_ORDER: readonly Group[] = [
	'server',
	'client',
	'shared',
	'lib',
	'routes',
	'services',
	'app'
];

// Map a docs/ directory to the module group it represents.
const DOC_DIR_TO_GROUP: Readonly<Record<string, Group>> = {
	backend: 'server',
	frontend: 'client'
};

const DOCS_ROOTS: readonly string[] = ['docs/backend', 'docs/frontend'];
const TEST_ROOTS: readonly string[] = ['tests/unit', 'tests/integration', 'tests/e2e'];

// ============================================================================
// PATH HELPERS
// ============================================================================

function asAbs(path: string): AbsPath {
	return path as AbsPath;
}

function asRel(path: string): RelPath {
	return path as RelPath;
}

function asModuleId(id: string): ModuleId {
	return id as ModuleId;
}

function extOf(path: string): string | null {
	const slash = path.lastIndexOf('/');
	const name = slash === -1 ? path : path.slice(slash + 1);
	const dot = name.lastIndexOf('.');
	if (dot <= 0) return null;
	return name.slice(dot + 1).toLowerCase();
}

function basenameOf(path: string): string {
	const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
	const slash = trimmed.lastIndexOf('/');
	return slash === -1 ? trimmed : trimmed.slice(slash + 1);
}

function languageOf(path: string): Language | null {
	const ext = extOf(path);
	if (ext === null) return null;
	if (!(ext in LANGUAGE_BY_EXT)) return null;
	return LANGUAGE_BY_EXT[ext as keyof typeof LANGUAGE_BY_EXT];
}

// ============================================================================
// DOC PARSER
// ============================================================================

const SOURCE_LINE_RE = /^\*\*Source:\*\*/;
const SRC_TOKEN_RE = /`(src\/[^`]+)`/g;

function extractSourcePaths(docSource: string): string[] {
	const out = new Set<string>();
	for (const line of docSource.split('\n')) {
		if (!SOURCE_LINE_RE.test(line)) continue;
		const matches = line.matchAll(SRC_TOKEN_RE);
		for (const m of matches) {
			// Strip trailing slash for consistent prefix matching downstream.
			const p = m[1].replace(/\/$/, '');
			out.add(p);
		}
	}
	return [...out];
}

async function pathExists(path: string, fs: Fs): Promise<boolean> {
	try {
		await fs.stat(path);
		return true;
	} catch (err) {
		if (err instanceof Deno.errors.NotFound) return false;
		throw err;
	}
}

async function parseDocumentedModules(root: string, fs: Fs): Promise<readonly DocumentedModule[]> {
	const modules: DocumentedModule[] = [];

	for (const docsDir of DOCS_ROOTS) {
		const absDir = `${root}/${docsDir}`;
		const group = DOC_DIR_TO_GROUP[basenameOf(docsDir)];
		if (!group) continue;

		if (!(await pathExists(absDir, fs))) continue;

		for await (const entry of fs.readDir(absDir)) {
			if (!entry.isFile || !entry.name.endsWith('.md')) continue;

			const relDoc = `${docsDir}/${entry.name}`;
			const source = await fs.readTextFile(`${root}/${relDoc}`);
			const declared = extractSourcePaths(source);

			const existing: AbsPath[] = [];
			for (const rel of declared) {
				const abs = `${root}/${rel}`;
				if (await pathExists(abs, fs)) existing.push(asAbs(abs));
			}
			if (existing.length === 0) continue;

			const basename = entry.name.replace(/\.md$/, '');
			modules.push({
				kind: 'documented',
				id: asModuleId(`${group}/${basename}`),
				group,
				basename,
				doc: asRel(relDoc),
				sources: existing
			});
		}
	}

	// Stable order for determinism.
	modules.sort((a, b) => a.id.localeCompare(b.id));
	return modules;
}

// ============================================================================
// FILE WALKING + CLASSIFICATION
// ============================================================================

async function walkFiles(absRoot: string, fs: Fs): Promise<AbsPath[]> {
	const out: AbsPath[] = [];

	async function walk(dir: string): Promise<void> {
		let entries: AsyncIterable<Deno.DirEntry>;
		try {
			entries = fs.readDir(dir);
		} catch (err) {
			if (err instanceof Deno.errors.NotFound) return;
			throw err;
		}
		for await (const entry of entries) {
			if (SKIP_DIRS.has(entry.name)) continue;
			const child = `${dir}/${entry.name}`;
			if (entry.isDirectory) {
				await walk(child);
			} else if (entry.isFile) {
				const ext = extOf(entry.name);
				if (ext !== null && EXTENSIONS.has(ext)) {
					out.push(asAbs(child));
				}
			}
		}
	}

	let info: Deno.FileInfo;
	try {
		info = await fs.stat(absRoot);
	} catch (err) {
		if (err instanceof Deno.errors.NotFound) return out;
		throw err;
	}

	if (info.isFile) {
		const ext = extOf(absRoot);
		if (ext !== null && EXTENSIONS.has(ext)) out.push(asAbs(absRoot));
	} else if (info.isDirectory) {
		await walk(absRoot);
	}

	out.sort();
	return out;
}

// Returns module id, group, and basename for a source file that isn't claimed
// by a documented module. "basename" is the namespace-child name used for test
// mapping (e.g. "pcd", "custom-formats", "adapter").
function classifyExtra(relFromRoot: string): { group: Group; basename: string } {
	for (const ns of NAMESPACE_CONTAINERS) {
		if (!relFromRoot.startsWith(ns.prefix)) continue;
		const rest = relFromRoot.slice(ns.prefix.length);
		const slash = rest.indexOf('/');
		const head = slash === -1 ? '_root' : rest.slice(0, slash);
		return { group: ns.group, basename: head };
	}
	// Not in a namespace: lives under src/ directly (app.css, adapter/, ...).
	// Group everything under 'app'. Single-file descendants of src/ collapse
	// to a single 'app/_root' module.
	const afterSrc = relFromRoot.startsWith('src/') ? relFromRoot.slice('src/'.length) : relFromRoot;
	const slash = afterSrc.indexOf('/');
	const head = slash === -1 ? '_root' : afterSrc.slice(0, slash);
	return { group: 'app', basename: head };
}

function claimFile(
	absFile: AbsPath,
	root: string,
	documented: readonly DocumentedModule[]
): { module: Module } {
	// Documented first: longest prefix wins (more specific path beats broader).
	let best: DocumentedModule | null = null;
	let bestLen = -1;
	for (const mod of documented) {
		for (const src of mod.sources) {
			if (absFile === src || absFile.startsWith(src + '/')) {
				if (src.length > bestLen) {
					best = mod;
					bestLen = src.length;
				}
			}
		}
	}
	if (best) return { module: best };

	const rel = absFile.startsWith(root + '/') ? absFile.slice(root.length + 1) : absFile;
	const { group, basename } = classifyExtra(rel);
	return {
		module: {
			kind: 'extra',
			id: asModuleId(`${group}/${basename}`),
			group,
			basename
		}
	};
}

// ============================================================================
// LINE COUNTER
// ============================================================================

// Classify one line under a comment rule. The `state` object is mutated to
// carry in-block state across lines. "Mixed" lines (code + trailing comment,
// or code followed by block-comment start) count as code.
interface CounterState {
	inBlock: boolean;
}

function classifyLine(line: string, rule: CommentRule, state: CounterState): keyof Counts {
	const len = line.length;
	let hadCode = false;
	let hadComment = false;
	let i = 0;

	while (i < len) {
		if (state.inBlock) {
			hadComment = true;
			if (rule.blockEnd === null) {
				i = len;
				break;
			}
			const endAt = line.indexOf(rule.blockEnd, i);
			if (endAt === -1) {
				i = len;
				break;
			}
			i = endAt + rule.blockEnd.length;
			state.inBlock = false;
			continue;
		}

		const ch = line.charCodeAt(i);
		if (ch === 32 || ch === 9 /* space, tab */) {
			i++;
			continue;
		}

		if (rule.line !== null && line.startsWith(rule.line, i)) {
			hadComment = true;
			i = len;
			break;
		}

		if (rule.blockStart !== null && line.startsWith(rule.blockStart, i)) {
			hadComment = true;
			state.inBlock = true;
			i += rule.blockStart.length;
			continue;
		}

		// Any other non-whitespace character is code. Short-circuit: once we
		// know the line has code, the classification is decided regardless of
		// any trailing comments on the same line.
		hadCode = true;
		break;
	}

	if (hadCode) return 'code';
	if (hadComment) return 'comment';
	return 'blank';
}

function countWithRule(source: string, rule: CommentRule): Counts {
	const state: CounterState = { inBlock: false };
	let code = 0;
	let comment = 0;
	let blank = 0;

	for (const line of source.split('\n')) {
		const kind = classifyLine(line, rule, state);
		if (kind === 'code') code++;
		else if (kind === 'comment') comment++;
		else blank++;
	}

	return { code, comment, blank };
}

// Svelte section-aware counter. We match <script>/<style> transitions only
// when the tag starts the line (after trimming). This misses pathological
// cases (<script> inside a template string), which is an accepted limitation.
const SVELTE_OPEN_SCRIPT = /^<script(\s|>|$)/i;
const SVELTE_OPEN_STYLE = /^<style(\s|>|$)/i;
const SVELTE_CLOSE_SCRIPT = /^<\/script\s*>/i;
const SVELTE_CLOSE_STYLE = /^<\/style\s*>/i;

type SvelteSection = 'template' | 'script' | 'style' | 'script-opening' | 'style-opening';

function countSvelte(source: string): Counts {
	let section: SvelteSection = 'template';
	const templateState: CounterState = { inBlock: false };
	let scriptState: CounterState = { inBlock: false };
	let styleState: CounterState = { inBlock: false };
	let code = 0;
	let comment = 0;
	let blank = 0;

	const bump = (kind: keyof Counts): void => {
		if (kind === 'code') code++;
		else if (kind === 'comment') comment++;
		else blank++;
	};

	for (const rawLine of source.split('\n')) {
		const trimmed = rawLine.trimStart();

		// Section closers fire before anything else so a lone </script> resets
		// state even if we somehow entered "script" in an odd way.
		if (section === 'script' && SVELTE_CLOSE_SCRIPT.test(trimmed)) {
			bump('code');
			section = 'template';
			scriptState = { inBlock: false };
			continue;
		}
		if (section === 'style' && SVELTE_CLOSE_STYLE.test(trimmed)) {
			bump('code');
			section = 'template';
			styleState = { inBlock: false };
			continue;
		}

		// Section openers (only from template).
		if (section === 'template') {
			if (SVELTE_OPEN_SCRIPT.test(trimmed)) {
				bump('code');
				section = trimmed.includes('>') ? 'script' : 'script-opening';
				continue;
			}
			if (SVELTE_OPEN_STYLE.test(trimmed)) {
				bump('code');
				section = trimmed.includes('>') ? 'style' : 'style-opening';
				continue;
			}
		}

		// Multi-line tag openers: keep counting as code until the closing '>'.
		if (section === 'script-opening') {
			bump('code');
			if (trimmed.includes('>')) section = 'script';
			continue;
		}
		if (section === 'style-opening') {
			bump('code');
			if (trimmed.includes('>')) section = 'style';
			continue;
		}

		switch (section) {
			case 'template':
				bump(classifyLine(rawLine, COMMENT_RULES.HTML, templateState));
				break;
			case 'script':
				bump(classifyLine(rawLine, COMMENT_RULES.TypeScript, scriptState));
				break;
			case 'style':
				bump(classifyLine(rawLine, COMMENT_RULES.CSS, styleState));
				break;
			default: {
				// Exhaustiveness: if we add a new section, TypeScript flags
				// this assignment as unreachable-if-covered or missing-if-not.
				const _never: never = section;
				throw new Error(`unreachable section: ${String(_never)}`);
			}
		}
	}

	return { code, comment, blank };
}

async function countFile(path: AbsPath, fs: Fs): Promise<FileCount> {
	let source: string;
	try {
		source = await fs.readTextFile(path);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, path, message };
	}

	const language = languageOf(path);
	if (language === null) {
		return { ok: false, path, message: `unknown extension for ${path}` };
	}

	const counts =
		language === 'Svelte' ? countSvelte(source) : countWithRule(source, COMMENT_RULES[language]);

	return { ok: true, path, language, counts };
}

// ============================================================================
// AGGREGATION
// ============================================================================

function addCounts(a: Counts, b: Counts): Counts {
	return { code: a.code + b.code, comment: a.comment + b.comment, blank: a.blank + b.blank };
}

const ZERO: Counts = { code: 0, comment: 0, blank: 0 };

// Totals are a derived view, not stored. Call once when rendering.
function totals(xs: readonly Counts[]): Counts {
	return xs.reduce(addCounts, ZERO);
}

// ============================================================================
// PIPELINE
// ============================================================================

interface RunInput {
	readonly root: string;
	readonly fs: Fs;
	readonly debug: boolean;
}

async function run(input: RunInput): Promise<Aggregated> {
	const { root, fs, debug } = input;
	const mark = makeTimer(debug);

	const documented = await parseDocumentedModules(root, fs);
	mark('discover:docs');

	const srcFiles = await walkFiles(`${root}/src`, fs);
	mark('walk:src');

	const testFiles: AbsPath[] = [];
	for (const testRoot of TEST_ROOTS) {
		for (const f of await walkFiles(`${root}/${testRoot}`, fs)) {
			testFiles.push(f);
		}
	}
	mark('walk:tests');

	const srcCounts = await Promise.all(srcFiles.map((f) => countFile(f, fs)));
	const testCounts = await Promise.all(testFiles.map((f) => countFile(f, fs)));
	mark('count');

	const errors: { path: AbsPath; message: string }[] = [];

	// By-module and by-language aggregation for sources.
	const moduleAgg = new Map<ModuleId, { module: Module; files: number; counts: Counts }>();
	const languageAgg = new Map<Language, { files: number; counts: Counts }>();

	for (const r of srcCounts) {
		if (!r.ok) {
			errors.push({ path: r.path, message: r.message });
			continue;
		}
		const { module } = claimFile(r.path, root, documented);

		const mEntry = moduleAgg.get(module.id);
		if (mEntry) {
			moduleAgg.set(module.id, {
				module: mEntry.module,
				files: mEntry.files + 1,
				counts: addCounts(mEntry.counts, r.counts)
			});
		} else {
			moduleAgg.set(module.id, { module, files: 1, counts: r.counts });
		}

		const lEntry = languageAgg.get(r.language);
		if (lEntry) {
			languageAgg.set(r.language, {
				files: lEntry.files + 1,
				counts: addCounts(lEntry.counts, r.counts)
			});
		} else {
			languageAgg.set(r.language, { files: 1, counts: r.counts });
		}
	}

	// Test-LOC per module, keyed by module basename. We only count code lines
	// for the T:S ratio (comments and blanks would flatter the signal).
	const testLocByBasename = new Map<string, number>();
	let testsTotal = 0;
	for (const r of testCounts) {
		if (!r.ok) {
			errors.push({ path: r.path, message: r.message });
			continue;
		}
		testsTotal += r.counts.code;
		const rel = r.path.startsWith(root + '/') ? r.path.slice(root.length + 1) : r.path;
		const basename = testModuleBasename(rel);
		if (basename === null) continue;
		testLocByBasename.set(basename, (testLocByBasename.get(basename) ?? 0) + r.counts.code);
	}
	mark('aggregate');

	// Several modules can share a basename (e.g. server/pcd + shared/pcd).
	// Attribute test LOC to exactly one owner per basename: highest group in
	// GROUP_ORDER, with documented preferred over extra within a group.
	const testOwnerByBasename = new Map<string, ModuleId>();
	const ownerCandidates = [...moduleAgg.values()].sort((a, b) => {
		const ga = GROUP_ORDER.indexOf(a.module.group);
		const gb = GROUP_ORDER.indexOf(b.module.group);
		if (ga !== gb) return ga - gb;
		if (a.module.kind !== b.module.kind) {
			return a.module.kind === 'documented' ? -1 : 1;
		}
		return a.module.id.localeCompare(b.module.id);
	});
	for (const { module } of ownerCandidates) {
		if (!testOwnerByBasename.has(module.basename)) {
			testOwnerByBasename.set(module.basename, module.id);
		}
	}

	const modules: ModuleStats[] = [];
	for (const { module, files, counts } of moduleAgg.values()) {
		const owns = testOwnerByBasename.get(module.basename) === module.id;
		const testLoc = owns ? (testLocByBasename.get(module.basename) ?? null) : null;
		modules.push({ module, files, counts, testLoc });
	}

	const languages: LanguageStats[] = [];
	for (const [language, { files, counts }] of languageAgg) {
		languages.push({ language, files, counts });
	}

	return {
		modules,
		languages,
		testsTotal,
		errors
	};
}

// tests/<kind>/<basename>/... -> basename
function testModuleBasename(rel: string): string | null {
	for (const tr of TEST_ROOTS) {
		const prefix = `${tr}/`;
		if (!rel.startsWith(prefix)) continue;
		const rest = rel.slice(prefix.length);
		const slash = rest.indexOf('/');
		if (slash === -1) return null;
		return rest.slice(0, slash);
	}
	return null;
}

// ============================================================================
// RENDERER
// ============================================================================

interface Colorizer {
	readonly bold: (s: string) => string;
	readonly dim: (s: string) => string;
	readonly cyan: (s: string) => string;
	readonly yellow: (s: string) => string;
	readonly green: (s: string) => string;
}

const ansiColor: Colorizer = {
	bold: (s) => `\x1b[1m${s}\x1b[22m`,
	dim: (s) => `\x1b[2m${s}\x1b[22m`,
	cyan: (s) => `\x1b[36m${s}\x1b[39m`,
	yellow: (s) => `\x1b[33m${s}\x1b[39m`,
	green: (s) => `\x1b[32m${s}\x1b[39m`
};

const noColor: Colorizer = {
	bold: (s) => s,
	dim: (s) => s,
	cyan: (s) => s,
	yellow: (s) => s,
	green: (s) => s
};

function shouldUseColor(): boolean {
	if (Deno.env.get('NO_COLOR') !== undefined) return false;
	const force = Deno.env.get('FORCE_COLOR');
	if (force !== undefined && force !== '0' && force !== 'false') return true;
	try {
		return Deno.stdout.isTerminal();
	} catch {
		return false;
	}
}

function pct(part: number, whole: number): string {
	if (whole === 0) return '0.0';
	return (Math.round((part / whole) * 1000) / 10).toFixed(1);
}

function formatLanguages(langs: readonly LanguageStats[], c: Colorizer): string {
	const totalCode = langs.reduce((n, l) => n + l.counts.code, 0);

	const sorted = [...langs].sort((a, b) => {
		if (b.counts.code !== a.counts.code) return b.counts.code - a.counts.code;
		return a.language.localeCompare(b.language);
	});

	const headers = ['Language', 'Files', 'Code', 'Lines', '% Code'] as const;
	const rows: readonly string[][] = sorted.map((l) => [
		l.language,
		String(l.files),
		String(l.counts.code),
		String(l.counts.code + l.counts.comment + l.counts.blank),
		`${pct(l.counts.code, totalCode)}%`
	]);
	const totalFiles = langs.reduce((n, l) => n + l.files, 0);
	const totalLines = langs.reduce(
		(n, l) => n + l.counts.code + l.counts.comment + l.counts.blank,
		0
	);
	const footer = ['TOTAL', String(totalFiles), String(totalCode), String(totalLines), '100.0%'];

	return renderTable(c.bold('LANGUAGE BREAKDOWN'), headers, rows, footer, c, [
		'left',
		'right',
		'right',
		'right',
		'right'
	]);
}

function formatModules(
	mods: readonly ModuleStats[],
	c: Colorizer
): { readonly text: string; readonly documented: number; readonly extras: number } {
	const totalCode = mods.reduce((n, m) => n + m.counts.code, 0);

	// Group, then sort within each group by code desc, alphabetical tie-break.
	const byGroup = new Map<Group, ModuleStats[]>();
	for (const m of mods) {
		const arr = byGroup.get(m.module.group);
		if (arr) arr.push(m);
		else byGroup.set(m.module.group, [m]);
	}
	for (const arr of byGroup.values()) {
		arr.sort((a, b) => {
			if (b.counts.code !== a.counts.code) return b.counts.code - a.counts.code;
			return a.module.id.localeCompare(b.module.id);
		});
	}

	const headers = [
		'Module',
		'Files',
		'Lines',
		'Code',
		'Comment',
		'Blank',
		'% Code',
		'Test',
		'T:S'
	] as const;
	const rows: string[][] = [];
	let documentedCount = 0;
	let extrasCount = 0;

	const alignments: readonly ('left' | 'right')[] = [
		'left',
		'right',
		'right',
		'right',
		'right',
		'right',
		'right',
		'right',
		'right'
	];

	for (const group of GROUP_ORDER) {
		const arr = byGroup.get(group);
		if (!arr || arr.length === 0) continue;
		if (rows.length > 0) rows.push([]); // blank separator row
		for (const m of arr) {
			if (m.module.kind === 'documented') documentedCount++;
			else extrasCount++;

			const marker = m.module.kind === 'extra' ? '*' : ' ';
			const label = `${marker} ${m.module.id}`;
			const lines = m.counts.code + m.counts.comment + m.counts.blank;
			const tsRatio =
				m.testLoc === null ? '' : m.counts.code === 0 ? '-' : `${pct(m.testLoc, m.counts.code)}%`;
			rows.push([
				label,
				String(m.files),
				String(lines),
				String(m.counts.code),
				String(m.counts.comment),
				String(m.counts.blank),
				`${pct(m.counts.code, totalCode)}%`,
				m.testLoc === null ? '' : String(m.testLoc),
				tsRatio
			]);
		}
	}

	const allCounts = mods.map((m) => m.counts);
	const sumCode = mods.reduce((n, m) => n + m.counts.code, 0);
	const sumLines = allCounts.reduce((n, c) => n + c.code + c.comment + c.blank, 0);
	const sumComment = allCounts.reduce((n, c) => n + c.comment, 0);
	const sumBlank = allCounts.reduce((n, c) => n + c.blank, 0);
	const sumFiles = mods.reduce((n, m) => n + m.files, 0);
	const sumTests = mods.reduce((n, m) => n + (m.testLoc ?? 0), 0);
	const footer = [
		'TOTAL',
		String(sumFiles),
		String(sumLines),
		String(sumCode),
		String(sumComment),
		String(sumBlank),
		'100.0%',
		String(sumTests),
		sumCode === 0 ? '-' : `${pct(sumTests, sumCode)}%`
	];

	const text = renderTable(c.bold('MODULE BREAKDOWN'), headers, rows, footer, c, alignments);
	return { text, documented: documentedCount, extras: extrasCount };
}

function formatSummary(agg: Aggregated, documented: number, extras: number, c: Colorizer): string {
	const t = totals(agg.modules.map((m) => m.counts));
	const lines = t.code + t.comment + t.blank;
	const files = agg.modules.reduce((n, m) => n + m.files, 0);
	const lang = agg.languages.length;
	const mods = agg.modules.length;

	const mappedTests = agg.modules.reduce((n, m) => n + (m.testLoc ?? 0), 0);
	const infraTests = agg.testsTotal - mappedTests;
	const testsValue =
		infraTests > 0
			? `${mappedTests} mapped / ${agg.testsTotal} total  (T:S ${t.code === 0 ? '-' : `${pct(mappedTests, t.code)}%`}; ${infraTests} LOC in test infra)`
			: `${mappedTests} code LOC  (T:S ${t.code === 0 ? '-' : `${pct(mappedTests, t.code)}%`})`;

	const rows: [string, string][] = [
		['Files', String(files)],
		['Lines', String(lines)],
		['Code', `${t.code}  (${pct(t.code, lines)}%)`],
		['Comments', `${t.comment}  (${pct(t.comment, lines)}%)`],
		['Blanks', `${t.blank}  (${pct(t.blank, lines)}%)`],
		['Languages', String(lang)],
		['Modules', `${mods}  (${documented} documented, ${extras} auto-discovered)`],
		['Tests', testsValue]
	];

	const out: string[] = [];
	out.push(c.bold('SUMMARY'));
	out.push(separator(66));
	const labelWidth = Math.max(...rows.map((r) => r[0].length));
	for (const [label, value] of rows) {
		out.push(`  ${label.padEnd(labelWidth)}   ${value}`);
	}
	return out.join('\n');
}

function formatErrors(errors: Aggregated['errors'], c: Colorizer): string | null {
	if (errors.length === 0) return null;
	const out: string[] = [];
	out.push(c.yellow(c.bold(`WARNINGS (${errors.length})`)));
	out.push(separator(66));
	for (const e of errors) {
		out.push(`  ${c.dim(e.path)}  ${e.message}`);
	}
	return out.join('\n');
}

// Generic table renderer. Takes headers, data rows, a footer row, and an
// alignment spec per column. Blank rows (empty array) become visual separators.
function renderTable(
	title: string,
	headers: readonly string[],
	rows: readonly string[][],
	footer: readonly string[],
	c: Colorizer,
	alignments: readonly ('left' | 'right')[]
): string {
	const cols = headers.length;
	const widths = new Array<number>(cols).fill(0);

	const update = (row: readonly string[]): void => {
		for (let i = 0; i < cols; i++) {
			const v = row[i] ?? '';
			if (v.length > widths[i]) widths[i] = v.length;
		}
	};

	update(headers);
	for (const row of rows) if (row.length > 0) update(row);
	update(footer);

	const dashes = headers.map((h) => '-'.repeat(Math.max(h.length, 1)));

	const fmtRow = (row: readonly string[]): string => {
		const cells: string[] = [];
		for (let i = 0; i < cols; i++) {
			const v = row[i] ?? '';
			const w = widths[i];
			cells.push(alignments[i] === 'right' ? v.padStart(w) : v.padEnd(w));
		}
		return cells.join('  ');
	};

	const out: string[] = [];
	out.push(title);
	out.push(separator(66));
	out.push(c.bold(fmtRow(headers)));
	out.push(c.dim(fmtRow(dashes)));
	for (const row of rows) {
		if (row.length === 0) {
			out.push('');
			continue;
		}
		out.push(fmtRow(row));
	}
	out.push(c.dim(fmtRow(dashes)));
	out.push(c.bold(fmtRow(footer)));
	return out.join('\n');
}

function separator(width: number): string {
	return '='.repeat(width);
}

function render(agg: Aggregated, c: Colorizer): string {
	const parts: string[] = [];
	parts.push(formatLanguages(agg.languages, c));
	parts.push('');
	const mods = formatModules(agg.modules, c);
	parts.push(mods.text);
	parts.push('');
	parts.push(formatSummary(agg, mods.documented, mods.extras, c));
	const errText = formatErrors(agg.errors, c);
	if (errText !== null) {
		parts.push('');
		parts.push(errText);
	}
	return parts.join('\n');
}

// ============================================================================
// TIMING
// ============================================================================

function makeTimer(debug: boolean): (label: string) => void {
	if (!debug) return () => {};
	let last = performance.now();
	return (label) => {
		const now = performance.now();
		const ms = (now - last).toFixed(1);
		last = now;
		console.error(`[stats] ${label.padEnd(16)} ${ms.padStart(7)} ms`);
	};
}

// ============================================================================
// MAIN
// ============================================================================

const realFs: Fs = {
	readTextFile: (p) => Deno.readTextFile(p),
	readDir: (p) => Deno.readDir(p),
	stat: (p) => Deno.stat(p)
};

async function main(): Promise<number> {
	const root = Deno.cwd();
	const debug = Deno.env.get('DEBUG') === '1';

	let agg: Aggregated;
	try {
		agg = await run({ root, fs: realFs, debug });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`stats: fatal: ${message}`);
		return 2;
	}

	if (agg.modules.length === 0) {
		console.error('stats: no modules discovered (is this the repo root?)');
		return 2;
	}

	const c = shouldUseColor() ? ansiColor : noColor;
	console.log(render(agg, c));
	return agg.errors.length > 0 ? 1 : 0;
}

if (import.meta.main) {
	Deno.exit(await main());
}
