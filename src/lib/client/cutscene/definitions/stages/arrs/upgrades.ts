import type { Stage } from '$cutscene/types.ts';

export const arrUpgradesStage: Stage = {
	id: 'arr-upgrades',
	name: 'Upgrades',
	description: 'Automated searching for better quality releases',
	prerequisites: [
		{
			check: 'hasArrInstance',
			message:
				'You need at least one connected Arr instance to start this stage. Follow the "Link" stage under Arr Instances from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'upgrades-why',
			route: { resolve: 'firstArrUpgrades' },
			title: 'Why Upgrades?',
			body: 'Arrs only search for releases when you first add something, then rely on RSS feeds to find upgrades. This works most of the time, but misses edge cases: your best indexers might have been down when a better release appeared, you might switch quality profiles, or a profile update might change what counts as an upgrade. Upgrades fills that gap by actively searching your library on a schedule.',
			completion: { type: 'manual' }
		},
		{
			id: 'upgrades-filters',
			target: 'upgrades-filters',
			title: 'Filters',
			body: 'Filters define which items in your library are eligible for upgrade searching. You can create multiple filters for different purposes: one for old movies below cutoff, another for recent additions, etc.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'upgrades-add-filter',
			target: 'upgrades-add-filter',
			title: 'Add a Filter',
			body: 'Click to create your first filter. This opens the filter editor where you can configure rules and settings.',
			position: 'below-left',
			completion: { type: 'click' }
		},
		{
			id: 'upgrades-filter-rules',
			target: 'upgrades-filter-rules',
			title: 'Filter Rules',
			body: 'Rules match items by field: title, year, rating, status, tags, and more. Combine rules with "All" (AND) or "Any" (OR) logic. Groups can be nested for complex conditions. For example: status is Released AND (rating > 7 OR year > 2020).',
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'upgrades-cutoff',
			target: 'upgrades-cutoff',
			title: 'Cutoff %',
			body: 'This sets the score threshold for the "cutoff met" field. If your quality profile\'s cutoff score is 90 and you set this to 80%, items scoring below 72 are considered below cutoff. Pair it with a "cutoff met is false" rule to target items that haven\'t reached your quality goals.',
			position: 'above',
			completion: { type: 'manual' }
		},
		{
			id: 'upgrades-method',
			target: 'upgrades-method',
			title: 'Method',
			body: 'The selector determines how items are prioritized from the matched set. Oldest targets items that have been waiting the longest. Lowest Score finds items furthest from your quality goals. Random spreads searches evenly.',
			position: 'above',
			completion: { type: 'manual' }
		},
		{
			id: 'upgrades-count',
			target: 'upgrades-count',
			title: 'Count',
			body: 'How many items to search per run. This is capped based on your schedule: more frequent runs means a lower max. The cap exists because indexers rate limit search requests. Profilarr calculates the safe maximum automatically.',
			position: 'above',
			completion: { type: 'manual' }
		},
		{
			id: 'upgrades-cooldown',
			target: 'upgrades-cooldown',
			title: 'Cooldown Tag',
			body: "After an item is searched, it gets tagged in your Arr instance so it won't be picked again next run. This spreads searches across your entire library over time. When every matched item has been tagged, the tags reset and the cycle starts over.",
			position: 'above',
			completion: { type: 'manual' }
		},
		{
			id: 'upgrades-schedule',
			target: 'upgrades-schedule',
			title: 'The Schedule',
			body: 'This controls how often a filter runs. Each time the schedule fires, only one filter executes. This is intentional; indexers rate limit search requests, and hitting them too aggressively can get you throttled or banned.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'upgrades-filter-mode',
			target: 'upgrades-filter-mode',
			title: 'Filter Mode',
			body: 'The mode controls which filter runs on each tick. Round robin cycles through your enabled filters in order. Random picks one at random. Either way, only one filter fires per scheduled run.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'upgrades-summary',
			title: 'Ready to Upgrade',
			body: 'Filters target items, selectors prioritize them, the schedule spaces everything out safely. Start with a dry run to test your setup, then enable when you are confident.',
			completion: { type: 'manual' }
		}
	]
};
