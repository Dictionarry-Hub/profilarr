/**
 * disable-comments
 *
 * Every comment that switches a lint rule off must say why, after `--`:
 *
 *   // eslint-disable-next-line some-rule -- reason
 *   <!-- eslint-disable-next-line some-rule -- reason -->
 *
 * Covers code comments (parsed by ESLint) and HTML comments in Svelte
 * templates, which ESLint doesn't parse as directives.
 *
 * Option `locked`: rules that can't be switched off at all in the files this
 * rule is configured for. A directive naming no rules switches everything
 * off, so it counts as naming each locked rule.
 */

import type { AST as ESTreeAST, Rule } from 'eslint';
import { svelteVisitors } from './svelte.ts';

interface Options {
	locked?: string[];
}

/**
 * ESLint's JavaScript source code parses disable comments for rules at
 * runtime, but its class type doesn't declare the method.
 */
interface DirectiveSource {
	getDisableDirectives(): {
		directives: {
			type: string;
			value: string;
			justification: string;
			node: { loc?: ESTreeAST.SourceLocation | null };
		}[];
	};
}

const HTML_DIRECTIVE_RE = /^\s*eslint-((?:disable|enable)(?:-line|-next-line)?)(?:\s+([\s\S]*))?$/;

// ESLint's own split between the rule list and the reason
const JUSTIFICATION_RE = /\s-{2,}\s/;

function splitDirective(text: string): { value: string; justification: string } {
	const match = JUSTIFICATION_RE.exec(text);
	if (!match) return { value: text.trim(), justification: '' };
	return {
		value: text.slice(0, match.index).trim(),
		justification: text.slice(match.index + match[0].length).trim()
	};
}

function ruleNames(value: string): string[] {
	return value
		.split(',')
		.map((name) => name.trim())
		.filter(Boolean);
}

const rule: Rule.RuleModule = {
	meta: {
		type: 'problem',
		docs: { description: 'Require a reason on disable comments, and lock chosen rules' },
		schema: [
			{
				type: 'object',
				properties: { locked: { type: 'array', items: { type: 'string' } } },
				additionalProperties: false
			}
		],
		messages: {
			missingReason: 'Add a reason after `--`: eslint-{{type}} <rule> -- <why>',
			locked: "{{rule}} can't be switched off here"
		}
	},
	create(context) {
		const options: Options = context.options[0] ?? {};
		const locked = options.locked ?? [];

		function check(
			type: string,
			value: string,
			justification: string,
			loc: ESTreeAST.SourceLocation
		): void {
			if (type === 'enable') return;
			if (!justification) {
				context.report({ loc, messageId: 'missingReason', data: { type } });
			}
			const names = ruleNames(value);
			for (const lockedRule of locked) {
				if (names.length === 0 || names.includes(lockedRule)) {
					context.report({ loc, messageId: 'locked', data: { rule: lockedRule } });
				}
			}
		}

		return svelteVisitors({
			Program() {
				const source = context.sourceCode as unknown as DirectiveSource;
				for (const directive of source.getDisableDirectives().directives) {
					const loc = directive.node.loc;
					if (loc) check(directive.type, directive.value, directive.justification, loc);
				}
			},
			SvelteHTMLComment(node) {
				const match = HTML_DIRECTIVE_RE.exec(node.value);
				if (!match) return;
				const { value, justification } = splitDirective(match[2] ?? '');
				check(match[1], value, justification, node.loc);
			}
		});
	}
};

export default rule;
