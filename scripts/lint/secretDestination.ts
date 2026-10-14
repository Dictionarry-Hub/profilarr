/**
 * secret-destination lint
 *
 * Rule: a stored secret must be re-entered whenever the destination it is
 * sent to changes. See docs/backend/security.md, "Secrets Follow Their
 * Destination". The server-side check is `requireSecretForDestinationChange()`
 * in src/lib/server/utils/secretDestination.ts.
 *
 * A lint cannot tell which form field is a destination, so it enforces the
 * decision instead: every `+page.server.ts` under src/routes that reads a
 * secret form field must either import the guard or carry a file-level
 * directive saying why no destination can change there:
 *
 *   // lint-disable-file secret-destination -- <reason>
 *
 * Usage: deno run --allow-read --allow-env scripts/lint/secretDestination.ts
 */

import { collectFiles } from './_lib.ts';

const RULE_NAME = 'secret-destination';
const SCOPE_ROOTS = ['src/routes'];
const PAGE_SERVER_RE = /(?:^|\/)\+page\.server\.ts$/;

/** Form fields that carry a secret which is later sent somewhere. */
const SECRET_FIELDS = [
	'api_key',
	'access_token',
	'auth_header',
	'webhook_url',
	'bot_token',
	'personal_access_token',
	'ai_api_key'
];

const SECRET_READ_RE = new RegExp(
	`formData\\.get\\(\\s*['"](${SECRET_FIELDS.join('|')})['"]\\s*\\)`
);
const GUARD_IMPORT_RE = /from\s+['"][^'"]*\/secretDestination\.ts['"]/;
const DISABLE_RE = /^\s*\/\/\s*lint-disable-file\s+secret-destination(?:\s+--\s*(.*?))?\s*$/m;

interface Violation {
	file: string;
	message: string;
}

function lintFile(file: string, source: string): Violation | null {
	const read = SECRET_READ_RE.exec(source);
	if (!read) return null;
	if (GUARD_IMPORT_RE.test(source)) return null;

	const disable = DISABLE_RE.exec(source);
	if (disable) {
		if (disable[1]?.trim()) return null;
		return {
			file,
			message: `directive needs a reason: // lint-disable-file ${RULE_NAME} -- <why no destination can change here>`
		};
	}

	return {
		file,
		message:
			`reads form field "${read[1]}" but neither imports requireSecretForDestinationChange() ` +
			`nor carries "// lint-disable-file ${RULE_NAME} -- <reason>"`
	};
}

async function main() {
	const files = await collectFiles({
		roots: SCOPE_ROOTS,
		acceptFile: (relPath) => PAGE_SERVER_RE.test(relPath)
	});

	const violations: Violation[] = [];
	for (const file of files) {
		const source = await Deno.readTextFile(file);
		const violation = lintFile(file, source);
		if (violation) violations.push(violation);
	}

	if (violations.length > 0) {
		console.error(`${RULE_NAME}: ${violations.length} violation(s)`);
		for (const v of violations) {
			console.error(`  ${v.file}: ${v.message}`);
		}
		Deno.exit(1);
	}

	console.log(`${RULE_NAME} lint passed (${files.length} files)`);
}

if (import.meta.main) {
	await main();
}
