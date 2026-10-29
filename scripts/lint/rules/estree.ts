/**
 * JavaScript node types, taken from ESLint's own rule types so rules don't
 * need a separate `estree` types package.
 */

import type { Rule } from 'eslint';

export type CallExpression = Parameters<NonNullable<Rule.NodeListener['CallExpression']>>[0];

/** Anything that can be called or have a property read from it. */
export type Callee = CallExpression['callee'];

/** The property name of `object.name`, or null for computed or private access. */
export function propertyName(node: Callee): string | null {
	if (node.type !== 'MemberExpression' || node.computed) return null;
	return node.property.type === 'Identifier' ? node.property.name : null;
}
