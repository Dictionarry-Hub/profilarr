import type { Stage } from '$cutscene/types.ts';

export const qpGeneralStage: Stage = {
	id: 'qp-general',
	name: 'General',
	description: 'Identity, description, tags, and language for a quality profile',
	prerequisites: [
		{
			check: 'hasDatabase',
			message:
				'You need at least one connected database to start this stage. Follow the "Link" stage under Databases from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'qp-general-intro',
			route: { resolve: 'firstQualityProfileGeneral' },
			title: 'Quality Profiles',
			body: "A quality profile decides which releases Radarr and Sonarr are allowed to grab and which one they prefer when several match. It does this in two layers: qualities sort releases into coarse tiers (1080p BluRay, 2160p Remux, and so on) and custom format scores break ties inside each tier. This stage walks through the General tab, where you set a profile's identity.",
			completion: { type: 'manual' }
		},
		{
			id: 'qp-general-name',
			target: 'qp-general-name',
			title: 'Name',
			body: 'The name identifies this profile when you link it to a Radarr or Sonarr instance. Keep it descriptive (for example "Remux Tier" or "Streaming Only") so future-you knows which instance should use it.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'qp-general-description',
			target: 'qp-general-description',
			title: 'Description',
			body: 'A markdown field for notes about what this profile is for, who it targets, and any tradeoffs you baked in. It does not affect matching or scoring, but it pays off when you revisit the profile later or hand it to someone else.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'qp-general-tags',
			target: 'qp-general-tags',
			title: 'Tags',
			body: 'Tags group profiles on the list page so you can filter by use case (audiophile, streaming, kids, archival) once your library grows. Like the description, tags are purely for organisation and never influence grabs.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'qp-general-language',
			target: 'qp-general-language',
			title: 'Language',
			body: 'Language is Radarr only and sets the preferred audio language for this profile. Sonarr ignores it entirely. If you want more nuanced language behavior (required languages, language scoring, Sonarr support) create a custom format that matches on language and score it on the Scoring tab instead.',
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'qp-general-summary',
			title: 'Summary',
			body: 'Name, description, tags, and language all live on the General tab. None of them decide which releases you grab, that is the job of the Scoring and Qualities tabs, which come next.',
			completion: { type: 'manual' }
		}
	]
};
