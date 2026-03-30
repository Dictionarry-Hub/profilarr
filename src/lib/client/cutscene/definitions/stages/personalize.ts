import type { Stage } from '../../types.ts';

export const personalizeStage: Stage = {
	id: 'personalize',
	name: 'Personalize',
	description: 'Set your theme and accent color',
	steps: [
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
			freeInteract: true,
			completion: { type: 'manual' }
		}
	]
};
