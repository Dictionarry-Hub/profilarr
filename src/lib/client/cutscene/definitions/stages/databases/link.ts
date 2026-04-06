import type { Stage } from '$cutscene/types.ts';

export const databaseLinkStage: Stage = {
	id: 'database-link',
	name: 'Link',
	description: 'Connect a configuration database',
	steps: [
		{
			id: 'databases-explain',
			target: 'nav-databases',
			title: 'Databases',
			body: "Now let's set up a database. Remember, databases are git repositories containing pre-built custom formats, quality profiles, and more. Anyone can create a Profilarr-compliant database, and you can connect as many as you like. A default database has already been connected for you, but you're free to remove it and use your own. Click Databases to continue.",
			position: 'below-right',
			completion: { type: 'click' }
		},
		{
			id: 'databases-add',
			route: '/databases',
			target: 'db-add',
			title: 'Connect a New Database',
			body: 'Click here to start connecting a new database.',
			position: 'below-left',
			completion: { type: 'click' }
		},
		{
			id: 'databases-form',
			route: '/databases/new',
			target: 'db-name-repo-branch',
			title: 'Name, Repository & Branch',
			body: 'Start by giving your database a friendly name, then paste in a GitHub repository URL. You can also specify a branch if you need one other than the default. Only GitHub is supported at the moment. If you ever need the same database on a different branch, just connect it again with a different branch selected.',
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
		},
		{
			id: 'databases-save',
			target: 'db-save',
			title: 'Save',
			body: "Once you're happy with your settings, hit Save to connect the database. Profilarr will clone the repository and import all its configurations.",
			position: 'below-left',
			completion: { type: 'manual' }
		}
	]
};
