import type { Stage } from '../../types.ts';

export const arrNavigationStage: Stage = {
	id: 'arr-navigation',
	name: 'Arr Navigation',
	description: 'Explore the tabs on a connected Arr instance',
	prerequisites: [
		{
			check: 'hasArrInstance',
			message:
				'You need at least one connected Arr instance to start this stage. Follow the "Connect an Arr Instance" stage from the onboarding page to add one.'
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
		}
	]
};
