/**
 * no-insecure-uuid
 *
 * `crypto.randomUUID` only exists in browser secure contexts (HTTPS or
 * localhost). Profilarr is often served over plain HTTP on a LAN, where the
 * call throws and crashes the page. Use `uuid()` from `#shared/utils/uuid.ts`,
 * which falls back outside secure contexts.
 *
 * Severity and scope are set in the config: an error in client code and
 * non-server routes, where `disable-comments` locks it on; a warning in
 * shared code, which may only run on the server. `uuid.ts` is exempt.
 *
 * Issue: https://github.com/Dictionarry-Hub/profilarr/issues/458
 */

import type { Rule } from 'eslint';
import { type Callee, propertyName } from './estree.ts';

/** True for `crypto`, `window.crypto`, `globalThis.crypto` and the like. */
function isCrypto(node: Callee): boolean {
	if (node.type === 'Identifier') return node.name === 'crypto';
	return propertyName(node) === 'crypto';
}

const rule: Rule.RuleModule = {
	meta: {
		type: 'problem',
		docs: { description: 'Use uuid() instead of crypto.randomUUID() in browser code' },
		schema: [],
		messages: {
			insecureUuid:
				"crypto.randomUUID() crashes over plain HTTP: import `uuid` from '#shared/utils/uuid.ts'"
		}
	},
	create(context) {
		return {
			CallExpression(node) {
				const callee = node.callee;
				if (propertyName(callee) !== 'randomUUID') return;
				if (callee.type !== 'MemberExpression' || !isCrypto(callee.object)) return;
				context.report({ node, messageId: 'insecureUuid' });
			}
		};
	}
};

export default rule;
