import type { Stage } from '$cutscene/types.ts';

export const welcomeStage: Stage = {
	id: 'welcome',
	name: 'Welcome',
	description: 'What Profilarr is and how it works',
	steps: [
		{
			id: 'what-is-profilarr',
			title: 'Welcome to Profilarr',
			body: 'Profilarr helps you build, test, and deploy media server configurations. Instead of manually configuring Radarr and Sonarr, you connect to curated databases and sync everything across your instances, while keeping any local tweaks you make.',
			completion: { type: 'manual' }
		},
		{
			id: 'nav-onboarding',
			target: 'nav-onboarding',
			title: 'Learning Profilarr',
			body: 'This is the onboarding page. It lives under Settings in the sidebar. Click it to get started.',
			position: 'right',
			completion: { type: 'click' }
		},
		{
			id: 'welcome-onboarding',
			title: 'The Onboarding Page',
			body: 'Each walkthrough here teaches one part of Profilarr with guided, hands-on steps. You can come back here anytime from Settings in the sidebar.',
			completion: { type: 'manual' }
		}
	]
};
