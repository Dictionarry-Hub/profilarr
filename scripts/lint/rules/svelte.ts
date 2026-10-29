/**
 * Types for rules that visit Svelte nodes. ESLint's listener type only knows
 * JavaScript nodes, so Svelte visitors are typed here and handed to ESLint
 * through `svelteVisitors()`.
 */

import type { Rule } from 'eslint';
import type { AST } from 'svelte-eslint-parser';

export type { AST };

export interface SvelteVisitors {
	Program?: () => void;
	'Program:exit'?: (node: AST.SvelteProgram) => void;
	SvelteElement?: (node: AST.SvelteElement) => void;
	SvelteHTMLComment?: (node: AST.SvelteHTMLComment) => void;
}

export function svelteVisitors(visitors: SvelteVisitors): Rule.RuleListener {
	return visitors as unknown as Rule.RuleListener;
}
