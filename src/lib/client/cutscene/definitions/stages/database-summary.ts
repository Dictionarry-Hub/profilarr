import type { Stage } from '../../types.ts';

export const databaseSummaryStage: Stage = {
	id: 'database-summary',
	name: 'Database Summary',
	description: 'Wrap up the databases section',
	steps: [
		{
			id: 'database-summary',
			title: "You're set up with databases",
			body: "You've learned how to link a database and explored the tabs where you'll manage changes, review commits, resolve conflicts, and configure settings. Your databases will stay in sync automatically if auto-pull is enabled, and any conflicts between your local tweaks and upstream updates will surface in the Conflicts tab when they happen.",
			completion: { type: 'manual' }
		}
	]
};
