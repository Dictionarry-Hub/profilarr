import type { Stage } from '$cutscene/types.ts';

export const settingsGeneralStage: Stage = {
	id: 'settings-general',
	name: 'General',
	description: 'App-wide preferences: interface, Arr defaults, backups, logging, and TMDB',
	steps: [
		{
			id: 'settings-general-intro',
			route: '/settings/general',
			title: 'General Settings',
			body: 'General is the app-wide preferences bucket: look-and-feel choices, defaults applied when you add a new Arr, plus quick toggles for the backup and logging jobs. Everything on this page sits on a single form with one Save button at the top, so changes do not apply until you save.',
			completion: { type: 'manual' }
		},
		{
			id: 'settings-general-interface',
			target: 'general-interface',
			title: 'Interface',
			body: 'Interface covers cosmetic preferences: whether the app uses emoji or lucide icons, where alerts appear and how long they stay on screen, and the sans and mono font families. The demo alert buttons on this card fire a sample notification so you can preview your choices without leaving the page.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-general-arr-defaults',
			target: 'general-arr-defaults',
			title: 'Arr Instance Defaults',
			body: 'Defaults applied when a new Arr instance is added. "Apply Default Delay Profile" toggles whether Profilarr sets a default delay profile on the first sync to a new Arr. On by default, so linking a fresh Arr picks up a sensible wait window without extra setup; turn it off if you would rather leave new Arrs with whatever delay profile they already have (or none) and set one yourself.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-general-backups',
			target: 'general-backups',
			title: 'Backups',
			body: 'Controls the automatic `backup.create` and `backup.cleanup` jobs: whether they run, when, and how long archives are kept. The archives themselves, plus manual create, upload, restore, and delete, all live on the Backups page. The Backups stage covers that side in detail.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-general-logging',
			target: 'general-logging',
			title: 'Logging',
			body: 'Controls what Profilarr captures and for how long: file and console logging on/off, minimum level, and retention days for the daily-rotated files. The Logs page is where you read what was captured. The Logs stage covers that viewer.',
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-general-tmdb',
			target: 'general-tmdb',
			title: 'TMDB Configuration',
			body: 'A TMDB API Read Access Token is only needed for the entity-testing feature inside quality profiles, which resolves titles and metadata against TMDB so you can test scoring against real releases. If you do not use entity testing, leave this blank.',
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-general-summary',
			title: 'Summary',
			body: 'General holds the knobs that shape the whole app: interface, Arr-link defaults, the backup and logging jobs, and an optional TMDB token. Save at the top commits every change on the page at once.',
			completion: { type: 'manual' }
		}
	]
};
