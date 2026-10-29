/**
 * no-raw-dates
 *
 * Two scopes (set in the config):
 *
 * 1. Query layer (`src/lib/server/db/queries/*.ts`): timestamp columns (fields
 *    ending in `_at`) must be wrapped in `toUTC()` when mapped to return
 *    values. A bare `createdAt: row.created_at` is a violation. SQL time
 *    comparisons must use `julianday()`: `datetime()` drops fractional
 *    seconds, so a time later in the current second compares as reached.
 *
 * 2. Route `.svelte` files: raw locale date methods and raw `new Date(x)` for
 *    display are banned. Use the display functions from `$shared/utils/dates`.
 *
 * Both checks read source lines, so they also look inside SQL strings.
 */

import type { Rule } from 'eslint';

// `somethingAt: row.something_at` without toUTC() on the rest of the line
const BARE_TIMESTAMP_RE = /(\w+(?:At|_at))\s*:\s*(?:row|r)\.(\w+_at)\b(?!.*toUTC)/;

// A `<`, `<=`, `>` or `>=` comparison with `datetime(...)` on either side.
// Writes like `datetime('now', '+5 minutes')` aren't comparisons and pass.
const SQL_DATETIME_COMPARE_RE = /\bdatetime\((?:[^()]|\([^()]*\))*\)\s*[<>]=?|[<>]=?\s*datetime\(/;

const COMMENT_LINE_RE = /^\s*(?:\/\/|\/\*|\*)/;

// `.toLocaleDateString()` and `.toLocaleTimeString()` are always date methods
const RAW_LOCALE_DATE_ONLY_RE = /\.toLocaleDateString\(|\.toLocaleTimeString\(/;
// `.toLocaleString()` is ambiguous (numbers have it too): flag it on a
// Date-like expression, or with Intl date formatting options
const RAW_TOLOCALESTRING_RE =
	/(?:new Date\([^)]*\)|(?<!\w)(?:date|d|parsed)\)?)\s*\.toLocaleString\(|\.toLocaleString\(\s*(?:undefined|'[^']*')\s*,\s*\{[^}]*(?:month|day|year|hour|minute|second)/i;
// `new Date(something)` directly in a template expression
const RAW_DATE_DISPLAY_RE = /\bnew Date\([^)]+\)\s*\}/;

const SCRIPT_OPEN_RE = /^<script\b/;
const SCRIPT_CLOSE_RE = /^<\/script>/;

const SUGGESTION_SCRIPT = 'use formatDateTime() or formatDate() from $shared/utils/dates';
const SUGGESTION_TEMPLATE = 'use <DateTime value={...} /> from $ui/datetime/DateTime.svelte';

const rule: Rule.RuleModule = {
	meta: {
		type: 'problem',
		docs: { description: 'Use the shared date helpers for timestamps and date display' },
		schema: [],
		messages: {
			bareTimestamp: '{{prop}}: {{field}} not wrapped in toUTC(). Use {{prop}}: toUTC({{field}})',
			sqlDatetimeCompare:
				"datetime() comparison drops fractional seconds. Use julianday(column) <= julianday('now')",
			rawLocale: 'Raw locale date method: {{suggestion}}',
			rawDateDisplay: 'Raw new Date() in template: {{suggestion}}'
		}
	},
	create(context) {
		const lines = context.sourceCode.lines;
		const at = (i: number, index: number) => ({ line: i + 1, column: index });

		function checkQueryFile() {
			lines.forEach((line, i) => {
				if (COMMENT_LINE_RE.test(line)) return;

				const bare = BARE_TIMESTAMP_RE.exec(line);
				if (bare) {
					context.report({
						loc: at(i, bare.index),
						messageId: 'bareTimestamp',
						data: { prop: bare[1], field: bare[2] }
					});
				}

				const compare = SQL_DATETIME_COMPARE_RE.exec(line);
				if (compare) {
					context.report({ loc: at(i, compare.index), messageId: 'sqlDatetimeCompare' });
				}
			});
		}

		function checkSvelteFile() {
			let inScript = false;
			lines.forEach((line, i) => {
				const trimmed = line.trimStart();
				if (SCRIPT_OPEN_RE.test(trimmed)) {
					inScript = true;
					return;
				}
				if (SCRIPT_CLOSE_RE.test(trimmed)) {
					inScript = false;
					return;
				}

				const suggestion = inScript ? SUGGESTION_SCRIPT : SUGGESTION_TEMPLATE;
				const locale = RAW_LOCALE_DATE_ONLY_RE.exec(line) ?? RAW_TOLOCALESTRING_RE.exec(line);
				if (locale) {
					context.report({
						loc: at(i, locale.index),
						messageId: 'rawLocale',
						data: { suggestion }
					});
				}

				const display = RAW_DATE_DISPLAY_RE.exec(line);
				if (display) {
					context.report({
						loc: at(i, display.index),
						messageId: 'rawDateDisplay',
						data: { suggestion }
					});
				}
			});
		}

		return {
			Program() {
				if (context.filename.endsWith('.svelte')) checkSvelteFile();
				else checkQueryFile();
			}
		};
	}
};

export default rule;
