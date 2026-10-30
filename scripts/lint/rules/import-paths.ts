/**
 * import-paths
 *
 * Every import of a project file has exactly one spelling:
 *
 *   import { db } from '#db/db.ts';            // another module: its alias
 *   import Row from './components/Row.svelte'; // same alias, this folder or below
 *
 * - Aliases come from `imports` in the nearest `package.json`; there is no
 *   other copy. The most specific alias wins (`#db/...`, not `#server/db/...`).
 * - Inside one alias, files in the importer's folder or below are imported
 *   with `./`. `../` is never allowed.
 * - The path names the real file with its real extension. Node and
 *   Playwright don't guess extensions or folder indexes, so `#db/db`,
 *   `#db/db.js` (for `db.ts`) and `#ui/table` fail there.
 * - At most `maxDepth` folders sit between an alias and the file, except for
 *   the aliases listed in `unlimited`.
 *
 * `--fix` rewrites an import to its one spelling when exactly one file
 * matches. Bare packages, `$app/*`, `$env/*` and `./$types` are left alone.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Rule } from 'eslint';

type Literal = NonNullable<
	Parameters<NonNullable<Rule.NodeListener['ImportDeclaration']>>[0]['source']
>;

interface Alias {
	name: string;
	dir: string;
}

interface Options {
	maxDepth?: number;
	unlimited?: string[];
}

// Kit generates `./$types` beside each route at build time
const KIT_TYPES = /^\.\/\$types(\.d\.ts|\.js)?$/;

// Tried in order when a path doesn't name a file
const GUESSES = ['.ts', '.js', '.svelte', '.d.ts', '/index.ts', '/index.js'];

function isFile(file: string): boolean {
	try {
		return fs.statSync(file).isFile();
	} catch {
		return false;
	}
}

/**
 * `#name/*` -> `./dir/*` entries from the nearest package.json with `imports`.
 * Read on every file rather than cached, so editors see new files and aliases.
 */
function aliasesFor(dir: string): Alias[] {
	const pkg = path.join(dir, 'package.json');
	if (isFile(pkg)) {
		const imports: Record<string, unknown> = JSON.parse(fs.readFileSync(pkg, 'utf8')).imports ?? {};
		const aliases = Object.entries(imports).flatMap(([key, target]) => {
			if (!key.endsWith('/*') || typeof target !== 'string' || !target.endsWith('/*')) return [];
			return [{ name: key.slice(0, -2), dir: path.resolve(dir, target.slice(0, -2)) }];
		});
		if (aliases.length > 0) return aliases;
	}
	const parent = path.dirname(dir);
	return parent === dir ? [] : aliasesFor(parent);
}

/** The alias whose folder most closely contains `file`. */
function aliasOf(file: string, aliases: Alias[]): Alias | null {
	let best: Alias | null = null;
	for (const alias of aliases) {
		if (!file.startsWith(alias.dir + path.sep)) continue;
		if (!best || alias.dir.length > best.dir.length) best = alias;
	}
	return best;
}

function toPosix(p: string): string {
	return p.split(path.sep).join('/');
}

/** The files a specifier could mean: itself if it is one, otherwise each guess that exists. */
function candidates(target: string): string[] {
	if (isFile(target)) return [target];
	const guesses = GUESSES.map((ext) => target + ext);
	if (target.endsWith('.js')) guesses.unshift(target.slice(0, -3) + '.ts');
	return [...new Set(guesses.filter(isFile))];
}

const rule: Rule.RuleModule = {
	meta: {
		type: 'problem',
		fixable: 'code',
		docs: { description: 'Import project files by their one alias or ./ spelling' },
		schema: [
			{
				type: 'object',
				properties: {
					maxDepth: { type: 'integer', minimum: 0 },
					unlimited: { type: 'array', items: { type: 'string' } }
				},
				additionalProperties: false
			}
		],
		messages: {
			spelling: "Import this file as '{{expected}}'",
			unknownAlias: "'{{alias}}' isn't an alias in package.json imports",
			notFound: "No file matches '{{specifier}}'",
			ambiguous: "'{{specifier}}' could mean {{files}}: name the file",
			noAlias: "No alias covers '{{file}}'",
			tooDeep:
				"'{{expected}}' is {{depth}} folders below {{alias}} (max {{max}}): add an alias or move the file"
		}
	},
	create(context) {
		const options: Options = context.options[0] ?? {};
		const maxDepth = options.maxDepth ?? Infinity;
		const unlimited = new Set(options.unlimited ?? []);
		const importer = context.filename;
		const importerDir = path.dirname(importer);
		const aliases = aliasesFor(importerDir);
		const importerAlias = aliasOf(importer, aliases);

		function check(statement: Rule.Node, source: Literal) {
			if (typeof source.value !== 'string') return;
			const [specifier, query = ''] = source.value.split(/(?=\?)/);
			if (!specifier.startsWith('.') && !specifier.startsWith('#')) return;
			if (KIT_TYPES.test(specifier)) return;

			let target: string;
			if (specifier.startsWith('#')) {
				const name = specifier.split('/')[0];
				const alias = aliases.find((a) => a.name === name);
				if (!alias) {
					context.report({ node: statement, messageId: 'unknownAlias', data: { alias: name } });
					return;
				}
				target = path.join(alias.dir, specifier.slice(name.length + 1));
			} else {
				target = path.resolve(importerDir, specifier);
			}

			const files = candidates(target);
			if (files.length === 0) {
				context.report({ node: statement, messageId: 'notFound', data: { specifier } });
				return;
			}
			if (files.length > 1) {
				const names = files.map((f) => `'${path.basename(f)}'`).join(' or ');
				context.report({
					node: statement,
					messageId: 'ambiguous',
					data: { specifier, files: names }
				});
				return;
			}
			const file = files[0];

			const targetAlias = aliasOf(file, aliases);
			const below = file.startsWith(importerDir + path.sep);
			let expected: string;
			if (below && targetAlias?.dir === importerAlias?.dir) {
				expected = './' + toPosix(path.relative(importerDir, file));
			} else if (targetAlias) {
				const rest = toPosix(path.relative(targetAlias.dir, file));
				expected = `${targetAlias.name}/${rest}`;
				const depth = rest.split('/').length - 1;
				if (depth > maxDepth && !unlimited.has(targetAlias.name)) {
					context.report({
						node: statement,
						messageId: 'tooDeep',
						data: { expected, depth: String(depth), alias: targetAlias.name, max: String(maxDepth) }
					});
				}
			} else {
				const shown = toPosix(path.relative(context.cwd, file));
				context.report({ node: statement, messageId: 'noAlias', data: { file: shown } });
				return;
			}

			if (expected === specifier) return;
			context.report({
				node: statement,
				messageId: 'spelling',
				data: { expected },
				fix: (fixer) => {
					const quote = source.raw?.[0] ?? "'";
					return fixer.replaceText(source, quote + expected + query + quote);
				}
			});
		}

		return {
			ImportDeclaration: (node) => check(node, node.source),
			ExportNamedDeclaration: (node) => node.source && check(node, node.source),
			ExportAllDeclaration: (node) => check(node, node.source),
			ImportExpression: (node) => {
				if (node.source.type === 'Literal') check(node, node.source);
			}
		};
	}
};

export default rule;
