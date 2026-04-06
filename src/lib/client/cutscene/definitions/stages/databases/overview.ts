import type { Stage } from '$cutscene/types.ts';

export const databaseOverviewStage: Stage = {
	id: 'database-manage',
	name: 'Overview',
	description: 'Tabs and features of a connected database',
	prerequisites: [
		{
			check: 'hasDatabase',
			message:
				'You need at least one connected database to start this stage. Follow the "Link" stage under Databases from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'db-nav-changes',
			route: { resolve: 'firstDatabaseChanges' },
			target: 'db-tab-changes',
			title: 'Changes',
			body: "The Changes tab is your sync dashboard. It shows the current git status of the database and any incoming upstream updates you haven't pulled yet. From here you can pull updates to stay in sync. If you're a database developer, you'll also see your outgoing draft changes with options to export and commit them back to the repository.",
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'db-nav-commits',
			route: { resolve: 'firstDatabaseCommits' },
			target: 'db-tab-commits',
			title: 'Commits',
			body: 'The Commits tab shows the commit history of the database repository. You can see what changed, when, and by whom.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'db-nav-conflicts',
			route: { resolve: 'firstDatabaseConflicts' },
			target: 'db-tab-conflicts',
			title: 'Conflicts',
			body: 'When your local tweaks clash with an upstream update, they surface here. Each conflict shows what changed on both sides. You can resolve them by aligning (dropping your change in favor of upstream) or overriding (keeping your version). The conflict strategy you set on the database controls whether this happens automatically or waits for your input.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'db-nav-tweaks',
			route: { resolve: 'firstDatabaseTweaks' },
			target: 'db-tab-tweaks',
			title: 'Tweaks',
			body: "The Tweaks tab is where you'll be able to view and manage your local overrides. This section is still being built.",
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'db-nav-settings',
			route: { resolve: 'firstDatabaseSettings' },
			target: 'db-tab-settings',
			title: 'Settings',
			body: "The Settings tab lets you configure this database's name, sync schedule, auto-pull behavior, and conflict resolution strategy. You can also disconnect the database from here.",
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'db-summary',
			title: "You're set up with databases",
			body: "You've learned how to connect a database and explored the tabs where you'll manage changes, review commits, resolve conflicts, and configure settings. Your databases will stay in sync automatically if auto-pull is enabled, and any conflicts between your local tweaks and upstream updates will surface in the Conflicts tab when they happen.",
			completion: { type: 'manual' }
		}
	]
};
