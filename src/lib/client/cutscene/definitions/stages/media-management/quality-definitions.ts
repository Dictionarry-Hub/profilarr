import type { Stage } from '$cutscene/types.ts';

export const mediaQualityDefinitionsStage: Stage = {
	id: 'media-quality-definitions',
	name: 'Quality Definitions',
	description: 'File size gates per quality tier, and why they rarely need tuning',
	prerequisites: [
		{
			check: 'hasDatabase',
			message:
				'You need at least one connected database to start this stage. Follow the "Link" stage under Databases from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'media-quality-definitions-intro',
			route: { resolve: 'firstQualityDefinitions' },
			title: 'Quality Definitions',
			body: 'Quality definitions set a minimum, preferred, and maximum file size (in MB per minute of runtime) for every quality Radarr and Sonarr know about. Releases outside the min/max range are rejected outright, and the preferred value is the size the grabber aims for when nothing else breaks the tie. The important thing to know: if your quality profiles already lean on well-scored custom formats, the scoring layer is already doing the preference work, and a narrow size window here just starts arguing with it. The usual move is to leave min at 0 and max at the top of the scale for every row, so size becomes a sanity check rather than a second ranking system. This config still has to exist and be saved before the linked database will let quality profiles sync, so it is worth opening once to confirm the defaults look reasonable before you move on.',
			completion: { type: 'manual' }
		}
	]
};
