/**
 * secret-destination
 *
 * A stored secret must be re-entered whenever the destination it is sent to
 * changes. See docs/backend/security.md, "Secrets Follow Their Destination".
 * The server-side check is `requireSecretForDestinationChange()` in
 * src/lib/server/utils/secretDestination.ts.
 *
 * A lint can't tell which form field is a destination, so it enforces the
 * decision instead: a `+page.server.ts` under src/routes that reads a secret
 * form field must import the guard, or switch this rule off for the file and
 * say why no destination can change there:
 *
 *   /* eslint-disable profilarr/secret-destination -- <reason> *\/
 */

import type { Rule } from 'eslint';

/** Form fields that carry a secret which is later sent somewhere. */
const SECRET_FIELDS = [
	'api_key',
	'access_token',
	'auth_header',
	'webhook_url',
	'bot_token',
	'personal_access_token',
	'ai_api_key',
	'basic_auth_password'
];

const SECRET_READ_RE = new RegExp(
	`formData\\.get\\(\\s*['"](${SECRET_FIELDS.join('|')})['"]\\s*\\)`
);
const GUARD_IMPORT_RE = /from\s+['"][^'"]*\/secretDestination\.ts['"]/;

const rule: Rule.RuleModule = {
	meta: {
		type: 'problem',
		docs: { description: 'Pages reading a secret field use the secret destination guard' },
		schema: [],
		messages: {
			missingGuard:
				'Reads form field "{{field}}" but doesn\'t import requireSecretForDestinationChange()'
		}
	},
	create(context) {
		return {
			Program() {
				const text = context.sourceCode.text;
				const read = SECRET_READ_RE.exec(text);
				if (!read || GUARD_IMPORT_RE.test(text)) return;

				const start = context.sourceCode.getLocFromIndex(read.index);
				const end = context.sourceCode.getLocFromIndex(read.index + read[0].length);
				context.report({
					loc: { start, end },
					messageId: 'missingGuard',
					data: { field: read[1] }
				});
			}
		};
	}
};

export default rule;
