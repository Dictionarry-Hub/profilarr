import type { Stage } from '$cutscene/types.ts';

export const cfGeneralStage: Stage = {
	id: 'cf-general',
	name: 'General',
	description: 'Identity, rename behavior, and references for a custom format',
	prerequisites: [
		{
			check: 'hasDatabase',
			message:
				'You need at least one connected database to start this stage. Follow the "Link" stage under Databases from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'cf-general-intro',
			route: { resolve: 'firstCustomFormatGeneral' },
			title: 'Custom Formats',
			body: "A custom format is a name attached to a set of conditions. When a release matches those conditions, the format applies, identifying something about the release: a codec, a release group, a source, a resolution. Quality profiles then score matched formats to rank competing releases. This stage walks through the General tab, where you set a format's identity and rename behavior.",
			completion: { type: 'manual' }
		},
		{
			id: 'cf-general-name',
			target: 'cf-general-name',
			title: 'Name',
			body: 'The name identifies this format in quality profiles and filenames. Keep it short and descriptive.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'cf-general-include-in-rename',
			target: 'cf-general-include-in-rename',
			title: 'Include In Rename',
			body: "When enabled, this format's name is appended to renamed filenames whenever a release matches. Use it to surface important tags like REMUX or HDR in the file itself. Leave it off for formats that shouldn't show up in filenames.",
			position: 'below-left',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'cf-general-description-tags',
			target: 'cf-general-description-tags',
			title: 'Description & Tags',
			body: 'Description is a markdown field for notes about what this format matches and why. Tags group formats for filtering on the custom formats list: codec, audio, HDR, language, and so on. Neither affects matching or scoring, but both pay off when you are looking through a large library of formats later.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'cf-general-references',
			target: 'cf-general-references',
			title: 'References',
			body: 'References lists every quality profile this format appears in, along with the score it receives in Radarr and Sonarr. Scoring is a profile-level setting, so the same format can be weighted differently in different profiles. This view is a quick check for where a change to the format might ripple before you make it.',
			position: 'above',
			completion: { type: 'manual' }
		},
		{
			id: 'cf-general-summary',
			title: 'Summary',
			body: 'Name, include in rename, description, and tags all live on the General tab, and the References section shows where this format is scored. Next you will define what the format actually matches by adding conditions.',
			completion: { type: 'manual' }
		}
	]
};
