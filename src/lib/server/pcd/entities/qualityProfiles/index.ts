/**
 * Quality Profile queries and mutations
 *
 * Types: import from '#shared/pcd/display.ts'
 */

// List queries
export { list, names, select } from './list.ts';

// General queries and mutations
export { general, languages } from './general/index.ts';
export { updateGeneral, updateLanguages } from './general/index.ts';

// Scoring queries and mutations
export { scoring, allCfScores } from './scoring/index.ts';
export { updateScoring } from './scoring/index.ts';

// Qualities queries and mutations
export { qualities } from './qualities/index.ts';
export { updateQualities } from './qualities/index.ts';

// Create and delete
export { create } from './create.ts';
export { remove } from './delete.ts';
