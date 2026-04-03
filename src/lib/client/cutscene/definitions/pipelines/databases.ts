import type { Pipeline } from '../../types.ts';

export const databasesPipeline: Pipeline = {
	id: 'databases',
	name: 'Databases',
	description: 'Learn how to connect and manage a database',
	stages: ['database-link', 'database-manage']
};
