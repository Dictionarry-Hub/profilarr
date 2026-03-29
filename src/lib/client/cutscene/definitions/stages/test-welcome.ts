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
			id: 'theme-toggle',
			target: 'theme-toggle',
			title: 'Theme',
			body: 'Click this to toggle between light and dark mode. Try it out, then continue.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'accent-picker',
			target: 'accent-picker',
			title: 'Accent Color',
			body: 'Pick a color that suits you. Click to open the picker, then choose one you like.',
			position: 'below-right',
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
