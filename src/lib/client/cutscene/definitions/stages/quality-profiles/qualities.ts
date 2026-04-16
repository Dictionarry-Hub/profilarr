import type { Stage } from '$cutscene/types.ts';

export const qpQualitiesStage: Stage = {
	id: 'qp-qualities',
	name: 'Qualities',
	description: 'Order qualities, enable what you want, and merge tiers into groups',
	prerequisites: [
		{
			check: 'hasDatabase',
			message:
				'You need at least one connected database to start this stage. Follow the "Link" stage under Databases from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'qp-qualities-intro',
			route: { resolve: 'firstQualityProfileQualities' },
			title: 'Qualities',
			body: 'Qualities are the coarse sorting layer. A higher-ranked quality always beats a lower one regardless of score, so this tab is where you decide which tiers are eligible and how they stack. Cards are drag-and-drop, and the checkboxes on the right control whether a tier is enabled and where upgrades stop.',
			completion: { type: 'manual' }
		},
		{
			id: 'qp-qualities-card',
			target: 'qp-qualities-card',
			title: 'Quality Card',
			body: 'Each card is either a single quality (for example, Bluray-1080p) or a group of qualities treated as equivalent for ranking. The list shows every quality the database knows about, including ones you currently have disabled, so ordering never silently changes when a quality is added or removed.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'qp-qualities-drag',
			target: 'qp-qualities-drag',
			title: 'Drag Handle',
			body: 'Click and drag the handle on the left edge of a card to reorder qualities. Higher in the list means higher priority; the top card wins any matchup where both releases are eligible. On desktop you can also drag a card onto another card to merge them into a group.',
			position: 'right',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'qp-qualities-upgrade-until',
			target: 'qp-qualities-upgrade-until',
			title: 'Upgrade Until',
			body: 'The green arrow marks the ceiling tier. Once a grab lands at or above this card, the profile stops looking for higher quality upgrades. Only one card can hold this marker per profile, so moving it to a new card automatically clears it from the old one.',
			position: 'below-left',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'qp-qualities-enabled',
			target: 'qp-qualities-enabled',
			title: 'Enabled',
			body: 'The blue check toggles whether this quality is eligible at all. Disabled cards stay in the list so ordering is preserved, but releases that match only a disabled tier will never be grabbed.',
			position: 'below-left',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'qp-qualities-group-button',
			target: 'qp-qualities-group-button',
			title: 'Groups',
			body: 'Groups collapse multiple qualities into a single tier so scores, not qualities, decide between them. For example, grouping Bluray-1080p with WEBDL-1080p lets a high-scoring WEB-DL beat a low-scoring BluRay. Existing groups get a pencil icon on their card so you can edit members later.',
			position: 'below-left',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'qp-qualities-summary',
			title: 'Summary',
			body: 'Drag to reorder, check to enable, mark the ceiling with upgrade until, and group tiers you want to treat as equals. Combined with the Scoring tab, you now have everything needed to turn your preferences into something Radarr and Sonarr can act on.',
			completion: { type: 'manual' }
		}
	]
};
