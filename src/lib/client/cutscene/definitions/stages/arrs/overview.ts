import type { Stage } from '$cutscene/types.ts';

export const arrOverviewStage: Stage = {
	id: 'arr-manage',
	name: 'Overview',
	description: 'Tabs and features of a connected Arr instance',
	prerequisites: [
		{
			check: 'hasArrInstance',
			message:
				'You need at least one connected Arr instance to start this stage. Follow the "Link" stage under Arr Instances from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'arr-nav-sync',
			route: { resolve: 'firstArrSync' },
			target: 'arr-tab-sync',
			title: 'Sync',
			body: "The Sync tab is where you configure what gets pushed to this instance. You'll set up media management, delay profiles, and quality profiles here. We'll walk through this in a dedicated stage later.",
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'arr-nav-library',
			route: { resolve: 'firstArrLibrary' },
			target: 'arr-tab-library',
			title: 'Library',
			body: "The Library tab shows everything on your Arr instance: movies for Radarr, series for Sonarr. You can browse items, see their quality profiles, custom format scores, and whether they've hit their quality cutoff.",
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'arr-nav-upgrades',
			route: { resolve: 'firstArrUpgrades' },
			target: 'arr-tab-upgrades',
			title: 'Upgrades',
			body: "The Upgrades tab lets you configure automated searches for better quality releases. Set up filters to target specific items and schedules to run searches automatically. We'll cover this in a dedicated stage later.",
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'arr-nav-renames',
			route: { resolve: 'firstArrRename' },
			target: 'arr-tab-renames',
			title: 'Renames',
			body: "The Renames tab handles bulk file and folder renaming to match your naming conventions. You can preview changes with a dry run before applying them. We'll cover this in a dedicated stage later.",
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'arr-nav-logs',
			route: { resolve: 'firstArrLogs' },
			target: 'arr-tab-logs',
			title: 'Logs',
			body: 'The Logs tab shows activity from this Arr instance. You can filter by log level and search for specific entries.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'arr-nav-settings',
			route: { resolve: 'firstArrSettings' },
			target: 'arr-tab-settings',
			title: 'Settings',
			body: 'The Settings tab lets you update connection details, configure library refresh intervals, set up automatic cleanup of stale configurations, and remove the instance if needed.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'arr-summary',
			title: "You're connected",
			body: "You've learned how to connect an Arr instance and explored the tabs where you'll manage your setup. The next steps are configuring sync to push configurations to your instance, setting up automated upgrades to search for better releases, and configuring renames to keep your files organized. Each of these has a dedicated walkthrough you can run from the onboarding page.",
			completion: { type: 'manual' }
		}
	]
};
