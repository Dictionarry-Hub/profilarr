/**
 * page-meta
 *
 * Route pages own their browser tab title through the shared PageMeta
 * component, so navigating from a page that set a title never leaves a stale
 * one behind:
 *
 *   <PageMeta title="Settings" />
 *
 * Raw <svelte:head> and <title> aren't allowed in route pages.
 *
 * Scope (set in the config): `+page.svelte` files under `src/routes/`.
 */

import type { Rule } from 'eslint';
import { type AST, svelteVisitors } from './svelte.ts';

const COMPONENT_NAME = 'PageMeta';

function isInHead(node: AST.SvelteElement): boolean {
	let parent: AST.SvelteElement['parent'] = node.parent;
	while (parent.type !== 'Program') {
		if (parent.type === 'SvelteElement' && parent.kind === 'special') {
			if (parent.name.name === 'svelte:head') return true;
		}
		parent = parent.parent as AST.SvelteElement['parent'];
	}
	return false;
}

const rule: Rule.RuleModule = {
	meta: {
		type: 'problem',
		docs: { description: 'Route pages render <PageMeta title="..." />' },
		schema: [],
		messages: {
			missingComponent: `Render <${COMPONENT_NAME} title="..." /> on every route page`,
			missingTitle: `Pass a short page title to <${COMPONENT_NAME}>`,
			rawHead: `Use <${COMPONENT_NAME} title="..." /> instead of <svelte:head>`,
			rawTitle: `Use <${COMPONENT_NAME} title="..." /> instead of <title>`
		}
	},
	create(context) {
		let pageMeta: AST.SvelteComponentElement | null = null;
		let pageMetaHasTitle = false;

		return svelteVisitors({
			SvelteElement(node) {
				if (node.kind === 'component') {
					if (node.name.type !== 'Identifier' || node.name.name !== COMPONENT_NAME) return;
					pageMeta ??= node;
					pageMetaHasTitle ||= node.startTag.attributes.some(
						(attr) => attr.type === 'SvelteAttribute' && attr.key.name === 'title'
					);
				} else if (node.kind === 'special' && node.name.name === 'svelte:head') {
					context.report({ loc: node.startTag.loc, messageId: 'rawHead' });
				} else if (node.kind === 'html' && node.name.name === 'title' && !isInHead(node)) {
					context.report({ loc: node.startTag.loc, messageId: 'rawTitle' });
				}
			},
			'Program:exit'(program) {
				if (!pageMeta) {
					context.report({ loc: program.loc.end, messageId: 'missingComponent' });
				} else if (!pageMetaHasTitle) {
					context.report({ loc: pageMeta.startTag.loc, messageId: 'missingTitle' });
				}
			}
		});
	}
};

export default rule;
