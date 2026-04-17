import type { Stage } from '$cutscene/types.ts';

export const mediaNamingStage: Stage = {
	id: 'media-naming',
	name: 'Naming',
	description: 'Control how Radarr and Sonarr lay out files and folders on disk',
	prerequisites: [
		{
			check: 'hasDatabase',
			message:
				'You need at least one connected database to start this stage. Follow the "Link" stage under Databases from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'media-naming-intro',
			route: { resolve: 'firstNaming' },
			title: 'Naming',
			body: "A naming config tells Radarr or Sonarr how to name files and folders on disk. This is the Profilarr-managed equivalent of the Arr's own Settings > Media Management > Episode/Movie Naming screen, and each config lives under a single arr type. Radarr handles a movie file format and a movie folder format, while Sonarr splits things further into standard, daily, and anime episode formats plus series and season folder formats. The default config on your linked database already ships sensible formats; this stage walks the shared sections so you know what to touch if you want to tweak them.",
			completion: { type: 'manual' }
		},
		{
			id: 'media-naming-formats',
			target: 'media-naming-formats',
			title: 'Naming Formats',
			body: 'Format strings use tokens (for example {Movie Title}, {Release Year}, {Quality Full} for Radarr, or {Series Title}, {season:00}, {episode:00}, {Episode Title} for Sonarr) wrapped in curly braces, and a live preview under each field shows how a real release would resolve. Type { in any format field to open the token picker. The fields themselves differ between Radarr and Sonarr; in Radarr you get movie and movie folder formats, in Sonarr you get three episode formats and two folder formats, but the token system and preview behave the same in both places.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'media-naming-character-replacement',
			target: 'media-naming-character-replacement',
			title: 'Character Replacement',
			body: 'Filesystems reject characters like : ? * < > | on most operating systems, so Radarr and Sonarr can rewrite them before they hit disk. "Replace Illegal Characters" is the master toggle; when it is on, the colon replacement dropdown decides how colons specifically are handled (delete, replace with space, dash, etc.). Sonarr also lets you pick a custom replacement string. Leave this enabled unless you are on a filesystem that tolerates the original characters and you want names preserved exactly.',
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'media-naming-summary',
			title: 'Summary',
			body: 'Naming formats shape every file and folder name, and character replacement keeps the result safe for your filesystem. Each config is tied to a single arr type, and nothing takes effect until you assign it on the Sync tab of an Arr instance.',
			completion: { type: 'manual' }
		}
	]
};
