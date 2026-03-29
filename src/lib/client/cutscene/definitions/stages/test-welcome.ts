import type { Stage } from '../../types.ts';

export const testWelcomeStage: Stage = {
	id: 'test-welcome',
	name: 'Welcome Tour',
	description: 'A quick intro to the Profilarr interface',
	steps: [
		{
			id: 'sidebar-nav',
			target: 'sidebar',
			title: 'Navigation',
			body: 'This is your main navigation. Use it to access different sections of the app.',
			position: 'right',
			completion: { type: 'manual' }
		},
		{
			id: 'help-button',
			target: 'help-button',
			title: 'Need Help?',
			body: 'This is your help button. Click it now to try it out!',
			position: 'above-left',
			completion: { type: 'click' }
		}
	]
};
