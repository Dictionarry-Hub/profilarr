import type { Pipeline } from '../../types.ts';

export const gettingStartedPipeline: Pipeline = {
	id: 'getting-started',
	name: 'Getting Started',
	description: 'Learn the basics of Profilarr',
	stages: ['welcome', 'navigation', 'database-link', 'database-navigation', 'personalize', 'help']
};
