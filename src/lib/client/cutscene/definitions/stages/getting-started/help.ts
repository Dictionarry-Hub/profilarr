import type { Stage } from '$cutscene/types.ts';

export const helpStage: Stage = {
	id: 'help',
	name: 'Help',
	description: 'Find the help button',
	silent: true,
	steps: [
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
