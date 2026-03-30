import type { Stage } from '../../types.ts';

export const databasesStage: Stage = {
	id: 'databases',
	name: 'Databases',
	description: 'Learn how to link a configuration database',
	steps: [
		{
			id: 'databases-explain',
			target: 'nav-databases',
			title: 'Databases',
			body: "Databases are where your configurations come from. They're git repositories containing pre-built custom formats, quality profiles, and more. Anyone can create a Profilarr-compliant database, and you can connect as many as you like. A default database has already been linked for you, but you're free to remove it and use your own. Press Continue and we'll show you how to link one.",
			position: 'right',
			completion: { type: 'manual' }
		},
		{
			id: 'databases-new',
			route: '/databases/new',
			target: 'db-header',
			title: 'Link a Database',
			body: 'This is where you link a new database to Profilarr.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'databases-form',
			target: 'db-name-repo-branch',
			title: 'Name, Repository & Branch',
			body: 'Start by giving your database a friendly name, then paste in a GitHub repository URL. You can also specify a branch if you need one other than the default. Only GitHub is supported at the moment. If you ever need the same database on a different branch, just link it again with a different branch selected.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'databases-pat',
			target: 'db-pat',
			title: 'Personal Access Token',
			body: "You only need this if you're connecting to a private repository, or if you're a database maintainer who needs to push updates back to GitHub. For most users this can be left blank. And no, you can't accidentally push anything to someone else's repo without one.",
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'databases-conflict',
			target: 'db-conflict',
			title: 'Conflict Strategy',
			body: "One of Profilarr's strengths is letting you tweak configurations locally. Occasionally those tweaks will conflict with an upstream update from the database. This setting controls what happens when that occurs: you can keep your version, accept the upstream change, or review each conflict yourself.",
			position: 'above',
			completion: { type: 'manual' }
		},
		{
			id: 'databases-sync',
			target: 'db-sync',
			title: 'Sync & Auto Pull',
			body: 'This controls how often Profilarr checks the remote repository for new updates, and whether those updates should be pulled in automatically or just trigger a notification so you can review them first.',
			position: 'above',
			completion: { type: 'manual' }
		}
	]
};
