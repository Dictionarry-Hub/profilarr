import type { Stage } from '$cutscene/types.ts';

export const mediaSettingsStage: Stage = {
	id: 'media-settings',
	name: 'Media Settings',
	description: 'Propers and repacks handling, and file analysis for renames',
	prerequisites: [
		{
			check: 'hasDatabase',
			message:
				'You need at least one connected database to start this stage. Follow the "Link" stage under Databases from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'media-settings-intro',
			route: { resolve: 'firstMediaSettings' },
			title: 'Media Settings',
			body: 'Media settings is the miscellaneous bucket: how Radarr or Sonarr treats propers and repacks, and whether it scans files for media information after import. Two decisions, both small on the surface, but both interact with the rest of your setup.',
			completion: { type: 'manual' }
		},
		{
			id: 'media-settings-name',
			target: 'media-settings-name',
			title: 'Name',
			body: 'The name identifies this media settings config when you assign it on the Sync tab of an Arr instance. Keep it descriptive (for example "default" for your baseline or "radarr-strict" for a variant) so the dropdown is easy to read later.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'media-settings-propers-repacks',
			target: 'media-settings-propers-repacks',
			title: 'Propers and Repacks',
			body: 'Propers and repacks are re-releases that a group puts out to fix a problem in an earlier upload (scene groups call them propers, p2p groups call them repacks, but they serve the same purpose). The Arr has its own built-in preference system for these, which predates custom formats. The recommended setting here is "Do Not Prefer": a well-built PCD already scores PROPER and REPACK tags through custom formats, so the scoring layer handles the upgrade decision cleanly. Leaving the Arr-level preference on creates a second, opaque ranking system that can quietly override your scores.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'media-settings-file-analysis',
			target: 'media-settings-file-analysis',
			title: 'File Analysis',
			body: 'Enable Media Info runs mediainfo against imported files to extract codec, resolution, audio tracks, and similar metadata. This matters downstream: the Rename tab builds filenames from naming tokens like {MediaInfo VideoCodec} and {MediaInfo AudioChannels}, and those tokens resolve to empty strings if media info was never collected. Leave this on if you want renames to produce complete filenames; turn it off only if the scan itself is causing problems on your storage.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'media-settings-summary',
			title: 'Summary',
			body: 'A descriptive name keeps the Sync dropdown readable, "Do Not Prefer" keeps propers and repacks out of your custom formats\' way, and leaving file analysis on lets renames fill in media tokens. Assign the config on the Sync tab of an Arr instance to activate it there.',
			completion: { type: 'manual' }
		}
	]
};
