import type { Stage } from '$cutscene/types.ts';

export const qpScoringStage: Stage = {
	id: 'qp-scoring',
	name: 'Scoring',
	description: 'Score custom formats and shape upgrade behavior for a profile',
	prerequisites: [
		{
			check: 'hasDatabase',
			message:
				'You need at least one connected database to start this stage. Follow the "Link" stage under Databases from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'qp-scoring-intro',
			route: { resolve: 'firstQualityProfileScoring' },
			title: 'Scoring',
			body: 'Scoring is the fine-grained preference layer. Every custom format that matches a release contributes its score, and the totals decide which release wins inside a quality tier. A high score does not guarantee a grab and a negative score does not block one; what matters is the total relative to other candidates.',
			completion: { type: 'manual' }
		},
		{
			id: 'qp-scoring-minimum',
			target: 'qp-scoring-minimum',
			title: 'Minimum Score',
			body: 'The total score a release must clear to be eligible for grabbing. Database maintainers pick a conservative default that rejects releases they consider undesirable. If you rely on public trackers or a library with sparse options, lower this so something imperfect still beats nothing.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'qp-scoring-upgrade-until',
			target: 'qp-scoring-upgrade-until',
			title: 'Upgrade Until Score',
			body: 'Once a grabbed release reaches this score, the profile stops looking for upgrades. Drop this to the same value as the minimum (or below) to effectively disable upgrade searches when you want the first acceptable release to stick.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'qp-scoring-increment',
			target: 'qp-scoring-increment',
			title: 'Upgrade Score Increment',
			body: 'The smallest score jump that counts as an upgrade. Raise this so trivial sidegrades (say, swapping one release group for another with a similar score) do not trigger a re-grab, and the profile holds out for a meaningful improvement.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'qp-scoring-actions',
			target: 'qp-scoring-actions',
			title: 'Actions',
			body: 'The toolbar helps you navigate a long list of custom formats. Search filters by name when you know which format you need to nudge. The rest are organisers: sort by name or by arr-type score, group by tags (audio, HDR, release group), switch the grid between one, two, or three columns, hide a Radarr or Sonarr column when you only care about one, hide unscored formats, and save a set of these preferences as a named view.',
			position: 'below-left',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'qp-scoring-row',
			target: 'qp-scoring-row',
			title: 'Scoring a Custom Format',
			body: 'Each row is one custom format. Radarr and Sonarr are scored independently: toggle the checkbox on the side you want to use, then enter the score. The same format can carry a different weight per app, and turning both off tells the profile to ignore it entirely.',
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'qp-scoring-summary',
			title: 'Summary',
			body: 'Minimum, upgrade until, and increment set the guard rails. The actions bar helps you find the format you want to change. Scores are per arr-type and stack up to decide which release wins. Next, the Qualities tab handles the coarse tiering layer above all this.',
			completion: { type: 'manual' }
		}
	]
};
