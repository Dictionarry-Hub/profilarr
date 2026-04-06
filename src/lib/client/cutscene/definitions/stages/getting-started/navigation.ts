import type { Stage } from '$cutscene/types.ts';

export const navigationStage: Stage = {
	id: 'navigation',
	name: 'Navigation',
	description: 'The main sections of the app',
	steps: [
		{
			id: 'sidebar-overview',
			target: 'sidebar',
			title: 'Navigation',
			body: "Let's take a quick look at the main sections of the app.",
			position: 'right',
			completion: { type: 'manual' }
		},
		{
			id: 'nav-databases',
			route: '/databases',
			target: 'nav-databases',
			title: 'Databases',
			body: "Databases are where your configurations come from. Connect one and everything inside is ready to browse, customize, and deploy to your Arr instances. We'll walk through connecting one later.",
			position: 'right',
			completion: { type: 'manual' }
		},
		{
			id: 'nav-arrs',
			route: '/arr',
			target: 'nav-arrs',
			title: 'Arrs',
			body: 'Your Arrs are the Radarr and Sonarr instances that Profilarr manages. Add them here, and any configurations you set up will sync directly to each one. You can connect as many as you need.',
			position: 'right',
			completion: { type: 'manual' }
		},
		{
			id: 'nav-config-entities',
			target: 'nav-config-entities',
			title: 'Configurations',
			body: "Databases provide several types of configuration: quality profiles, custom formats, regular expressions, delay profiles, and media management settings like naming and quality definitions. Each has its own section in the sidebar. We'll cover them in more detail later.",
			position: 'right',
			completion: { type: 'manual' }
		},
		{
			id: 'nav-settings',
			route: '/settings',
			target: 'nav-settings',
			title: 'Settings',
			body: 'This is where you configure Profilarr itself. Scheduled jobs, notification alerts, security, backups, and general preferences all live here. Most defaults work out of the box, so you can come back to this later.',
			position: 'right',
			completion: { type: 'manual' }
		}
	]
};
