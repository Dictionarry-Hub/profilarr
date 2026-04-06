import type { Stage } from '$cutscene/types.ts';

export const arrSyncStage: Stage = {
	id: 'arr-sync',
	name: 'Sync',
	description: 'Configure what gets synced and when',
	prerequisites: [
		{
			check: 'hasArrInstance',
			message:
				'You need at least one connected Arr instance to start this stage. Follow the "Link" stage under Arr Instances from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'sync-overview',
			route: { resolve: 'firstArrSync' },
			title: 'What is Sync?',
			body: "Sync pushes configurations from your databases into your Arr instances. Profilarr stores everything in its own format, then compiles it into what Radarr or Sonarr expects. This lets Profilarr do things the Arrs can't natively, like reusing regular expressions across custom formats.",
			completion: { type: 'manual' }
		},
		{
			id: 'sync-media-management',
			target: 'sync-media-management',
			title: 'Media Management',
			body: 'Media management covers naming conventions, quality definitions, and media settings. This needs to be configured and saved before quality profiles can be synced.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'sync-delay-profiles',
			target: 'sync-delay-profiles',
			title: 'Delay Profiles',
			body: 'Delay profiles control protocol preferences, delays, and score gates. Like media management, these must be configured and saved before quality profiles.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'sync-quality-profiles',
			target: 'sync-quality-profiles',
			title: 'Quality Profiles',
			body: "Quality profiles are the core of your configuration. Select which profiles to sync from your connected databases. Custom formats don't need to be selected individually; if a custom format is part of a quality profile, it syncs automatically.",
			position: 'above',
			completion: { type: 'manual' }
		},
		{
			id: 'sync-trigger',
			target: 'sync-trigger',
			title: 'Triggers',
			body: 'Each section has its own trigger that controls when sync happens. Manual means you click sync yourself. On Pull syncs automatically when new changes arrive from a database. Schedule runs on a cron expression you define.',
			position: 'below-right',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'sync-how-it-works',
			target: 'sync-how-it-works',
			title: 'How it Works',
			body: 'For a deeper breakdown of sync mechanics, triggers, cron expressions, and setup order, click this button anytime. It covers everything in detail.',
			position: 'below-left',
			completion: { type: 'manual' }
		},
		{
			id: 'sync-summary',
			title: 'Ready to Sync',
			body: 'Configure from top to bottom: media management and delay profiles first, then quality profiles. Custom formats come along with their quality profiles automatically. Each section can have its own trigger, so you can mix manual and automatic syncing.',
			completion: { type: 'manual' }
		}
	]
};
