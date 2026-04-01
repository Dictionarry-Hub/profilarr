import type { Stage } from '../../types.ts';

export const welcomeStage: Stage = {
	id: 'welcome',
	name: 'Welcome',
	description: 'Learn what Profilarr is and how it works',
	steps: [
		{
			id: 'what-is-profilarr',
			title: 'Welcome to Profilarr',
			body: 'Profilarr helps you build, test, and deploy media server configurations. Instead of manually configuring Radarr and Sonarr, you connect to curated databases and sync everything across your instances, while keeping any local tweaks you make.',
			completion: { type: 'manual' }
		}
	]
};
