/**
 * no-raw-ui
 *
 * UI code uses the wrapper components from `#ui/*`, not raw HTML elements.
 * Banned: <button>, <input>, <select>, <textarea>, <dialog>, <table>.
 *
 * `<input type="hidden">` is allowed when `type` is a static string: hidden
 * inputs are SvelteKit form-action plumbing, not visible UI.
 *
 * Scope (set in the config): `.svelte` files under `src/routes/` and
 * `src/lib/client/`, except `src/lib/client/ui/`, which holds the wrappers.
 *
 * Issue: https://github.com/Dictionarry-Hub/profilarr/issues/298
 */

import type { Rule } from 'eslint';
import { type AST, svelteVisitors } from './svelte.ts';

const SIMPLE_SUGGESTIONS: Record<string, string> = {
	button: '#ui/button/Button.svelte',
	select: '#ui/dropdown/DropdownSelect.svelte',
	textarea: '#ui/form/MarkdownInput.svelte',
	dialog: '#ui/modal/Modal.svelte',
	table: '#ui/table/Table.svelte'
};

const INPUT_SUGGESTIONS: Record<string, string> = {
	checkbox: '#ui/toggle/Toggle.svelte (or #ui/form/IconCheckbox.svelte)',
	number: '#ui/form/NumberInput.svelte',
	date: '#ui/form/DateInput.svelte',
	time: '#ui/form/TimeInput.svelte'
};

const INPUT_DEFAULT = '#ui/form/FormInput.svelte';

/** The `type` attribute's value if it's a static string, `''` if absent, else `null`. */
function staticType(element: AST.SvelteHTMLElement): string | null {
	for (const attr of element.startTag.attributes) {
		if (attr.type !== 'SvelteAttribute' || attr.key.name.toLowerCase() !== 'type') continue;
		if (attr.boolean) return '';
		let value = '';
		for (const part of attr.value) {
			if (part.type !== 'SvelteLiteral') return null;
			value += part.value;
		}
		return value;
	}
	return '';
}

const rule: Rule.RuleModule = {
	meta: {
		type: 'problem',
		docs: { description: 'Use the #ui wrapper components instead of raw HTML elements' },
		schema: [],
		messages: { rawUi: 'Raw <{{tag}}>: use {{component}}' }
	},
	create(context) {
		return svelteVisitors({
			SvelteElement(node) {
				if (node.kind !== 'html') return;
				const tag = node.name.name;

				let component = SIMPLE_SUGGESTIONS[tag];
				if (tag === 'input') {
					const type = staticType(node);
					if (type === 'hidden') return;
					component = (type && INPUT_SUGGESTIONS[type]) || INPUT_DEFAULT;
				}
				if (!component) return;

				context.report({
					loc: node.startTag.loc,
					messageId: 'rawUi',
					data: { tag, component }
				});
			}
		});
	}
};

export default rule;
