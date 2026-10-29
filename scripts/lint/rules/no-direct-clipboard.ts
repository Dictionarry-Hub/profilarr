/**
 * no-direct-clipboard-copy, no-direct-clipboard-paste
 *
 * Browser clipboard reads and writes only work in secure contexts, so direct
 * `navigator.clipboard.*Text()` calls fail when Profilarr is served over plain
 * HTTP on a LAN. Copy with `copyToClipboard` from the client clipboard helper;
 * paste through `PasteModal`.
 *
 * Scope (set in the config): client code and non-server routes, except the
 * clipboard helper itself.
 */

import type { Rule } from 'eslint';
import { type CallExpression, type Callee, propertyName } from './estree.ts';

/** True for `name`, `window.name` and `globalThis.name`. */
function isGlobal(node: Callee, name: string): boolean {
	if (node.type === 'Identifier') return node.name === name;
	if (propertyName(node) !== name || node.type !== 'MemberExpression') return false;
	return node.object.type === 'Identifier' && ['window', 'globalThis'].includes(node.object.name);
}

function isClipboardCall(node: CallExpression, method: string): boolean {
	const callee = node.callee;
	if (propertyName(callee) !== method || callee.type !== 'MemberExpression') return false;
	const clipboard = callee.object;
	if (propertyName(clipboard) !== 'clipboard' || clipboard.type !== 'MemberExpression') {
		return false;
	}
	return isGlobal(clipboard.object, 'navigator');
}

function isExecCommandCopy(node: CallExpression): boolean {
	const callee = node.callee;
	if (propertyName(callee) !== 'execCommand' || callee.type !== 'MemberExpression') return false;
	if (!isGlobal(callee.object, 'document')) return false;
	const [first] = node.arguments;
	return first?.type === 'Literal' && first.value === 'copy';
}

export const noDirectClipboardCopy: Rule.RuleModule = {
	meta: {
		type: 'problem',
		docs: { description: 'Copy through the client clipboard helper' },
		schema: [],
		messages: {
			directCopy:
				"Direct clipboard copy: import `copyToClipboard` from '#client/utils/clipboard.ts'"
		}
	},
	create(context) {
		return {
			CallExpression(node) {
				if (isClipboardCall(node, 'writeText') || isExecCommandCopy(node)) {
					context.report({ node, messageId: 'directCopy' });
				}
			}
		};
	}
};

export const noDirectClipboardPaste: Rule.RuleModule = {
	meta: {
		type: 'problem',
		docs: { description: 'Paste through PasteModal' },
		schema: [],
		messages: {
			directPaste: "Direct clipboard paste: use `PasteModal` from '#ui/modal/PasteModal.svelte'"
		}
	},
	create(context) {
		return {
			CallExpression(node) {
				if (isClipboardCall(node, 'readText')) {
					context.report({ node, messageId: 'directPaste' });
				}
			}
		};
	}
};
