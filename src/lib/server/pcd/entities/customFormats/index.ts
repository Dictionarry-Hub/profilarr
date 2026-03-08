/**
 * Custom Format queries and mutations
 *
 * Types: import from '$shared/pcd/display.ts'
 */

// General queries/mutations
export { general } from './general/index.ts';
export { updateGeneral } from './general/index.ts';

// Condition queries/mutations
export {
	getConditionsForEvaluation,
	getAllConditionsForEvaluation,
	listConditions
} from './conditions/index.ts';
export { updateConditions } from './conditions/index.ts';

// Test queries/mutations
export { getById, listTests, getTest } from './tests/index.ts';
export { createTest } from './tests/index.ts';
export { updateTest } from './tests/index.ts';
export { deleteTest } from './tests/index.ts';

// Main custom format operations
export { list } from './list.ts';
export { create } from './create.ts';
export { remove } from './delete.ts';
export { evaluateCustomFormat, getParsedInfo, extractPatternsByType } from './evaluator.ts';
export type { PatternsByType, PatternMatchMaps } from './evaluator.ts';
