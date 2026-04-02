import type { Pipeline } from '../../types.ts';

export const databasesPipeline: Pipeline = {
	id: 'databases',
	name: 'Databases',
	description: 'Learn how to link and navigate a database',
	stages: ['database-link', 'database-navigation']
};
