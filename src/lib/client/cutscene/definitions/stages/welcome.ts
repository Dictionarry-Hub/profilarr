import type { Stage } from '../../types.ts';

export const welcomeStage: Stage = {
	id: 'welcome',
	name: 'Welcome',
	description: 'Learn what Profilarr is and how it works',
	steps: [
		{
			id: 'what-is-profilarr',
			title: 'Welcome to Profilarr',
			body: 'Profilarr helps you build, test, and deploy media server configurations. Instead of manually configuring Radarr and Sonarr, you connect to curated databases and sync everything across your instances, while keeping any local tweaks you make.',
			completion: { type: 'manual' }
		},
		{
			id: 'sidebar-overview',
			target: 'sidebar',
			title: 'Navigation',
			body: "This is your sidebar. Let's walk through what each section does.",
			position: 'right',
			completion: { type: 'manual' }
		},
		{
			id: 'nav-databases',
			route: '/databases',
			target: 'nav-databases',
			title: 'Databases',
			body: "Databases provide your configurations. They're curated git repositories full of pre-built profiles, formats, and settings. We'll cover linking one in detail later.",
			position: 'right',
			completion: { type: 'manual' }
		},
		{
			id: 'nav-quality-profiles',
			route: '/quality-profiles',
			target: 'nav-quality-profiles',
			title: 'Quality Profiles',
			body: 'Quality profiles control how your Arr instances prioritize and score releases. They determine which qualities are acceptable, what order to prefer them in, and how custom formats influence the final ranking.',
			position: 'right',
			completion: { type: 'manual' }
		},
		{
			id: 'nav-custom-formats',
			route: '/custom-formats',
			target: 'nav-custom-formats',
			title: 'Custom Formats',
			body: 'Custom formats define rules for matching releases by things like resolution, source, codec, and release group. They work together with quality profiles to fine-tune what gets downloaded.',
			position: 'right',
			completion: { type: 'manual' }
		},
		{
			id: 'nav-regex',
			route: '/regular-expressions',
			target: 'nav-regex',
			title: 'Regular Expressions',
			body: "Unlike Radarr and Sonarr where regex patterns are embedded inside custom formats, Profilarr treats them as their own entity. This means they're reusable across multiple formats. If you use the same pattern in ten formats, you only need to update it in one place.",
			position: 'right',
			completion: { type: 'manual' }
		},
		{
			id: 'nav-media-management',
			route: '/media-management',
			target: 'nav-media-management',
			title: 'Media Management',
			body: 'Media management covers naming conventions, quality definitions, and media settings. This is where you control how files and folders are named, what quality thresholds are used, and other media-related preferences.',
			position: 'right',
			completion: { type: 'manual' }
		},
		{
			id: 'nav-delay-profiles',
			route: '/delay-profiles',
			target: 'nav-delay-profiles',
			title: 'Delay Profiles',
			body: 'Delay profiles let you set protocol preferences and release delays. You can prioritize torrents over usenet or vice versa, and set minimum wait times before grabbing a release.',
			position: 'right',
			completion: { type: 'manual' }
		},
		{
			id: 'nav-arrs',
			route: '/arr',
			target: 'nav-arrs',
			title: 'Arrs',
			body: 'This is where you connect your Radarr and Sonarr instances. Once connected, you can deploy your configurations to them and keep everything in sync.',
			position: 'right',
			completion: { type: 'manual' }
		},
		{
			id: 'nav-settings',
			route: '/settings',
			target: 'nav-settings',
			title: 'Settings',
			body: 'Jobs, notifications, security, backups, and general app settings all live here.',
			position: 'right',
			completion: { type: 'manual' }
		}
	]
};
