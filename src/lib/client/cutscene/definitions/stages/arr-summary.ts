import type { Stage } from '../../types.ts';

export const arrSummaryStage: Stage = {
	id: 'arr-summary',
	name: 'Arr Summary',
	description: 'Wrap up the Arr instances section',
	steps: [
		{
			id: 'arr-summary',
			title: "You're connected",
			body: "You've learned how to connect an Arr instance and explored the tabs where you'll manage your setup. The next steps are configuring sync to push configurations to your instance, setting up automated upgrades to search for better releases, and configuring renames to keep your files organized. Each of these has a dedicated walkthrough you can run from the onboarding page.",
			completion: { type: 'manual' }
		}
	]
};
