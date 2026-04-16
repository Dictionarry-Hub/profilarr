import type { Stage } from '$cutscene/types.ts';

export const cfConditionsStage: Stage = {
	id: 'cf-conditions',
	name: 'Conditions',
	description: 'Define what a custom format matches on a release',
	prerequisites: [
		{
			check: 'hasDatabase',
			message:
				'You need at least one connected database to start this stage. Follow the "Link" stage under Databases from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'cf-conditions-intro',
			route: { resolve: 'firstCustomFormatConditions' },
			title: 'Conditions',
			body: 'Conditions are the rules that decide whether a release matches a custom format. Each one targets a specific piece of parsed metadata (release title, release group, source, resolution, language, year, size, and so on) and checks it against a value or regex pattern. Conditions of the same type are combined with OR by default, and conditions across types are combined with AND. Two modifiers, Required and Negate, let you flip that logic where needed. This stage walks through adding one condition from scratch.',
			completion: { type: 'manual' }
		},
		{
			id: 'cf-conditions-add',
			target: 'cf-conditions-add',
			title: 'Add a Condition',
			body: 'Click Add Condition to spawn a draft card. Drafts sit at the top of the list until you confirm them, which keeps you from accidentally saving a half-configured rule.',
			position: 'below-left',
			completion: { type: 'click' }
		},
		{
			id: 'cf-conditions-name',
			target: 'cf-cond-name',
			title: 'Name',
			body: "Names label conditions within a format and must be unique. A good name describes the match in plain language (for example, '1080p' or 'FraMeSToR release group') so the purpose is obvious when you revisit the format later.",
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'cf-conditions-type',
			target: 'cf-cond-type',
			title: 'Type',
			body: 'Type chooses which piece of parsed metadata this condition looks at. Release Title, Release Group, and Edition take regex patterns. Resolution, Source, Quality Modifier, Language, Release Type, and Indexer Flag pick from a fixed list. Size and Year take a numeric range. The value field adapts to the type you pick.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'cf-conditions-value',
			target: 'cf-cond-value',
			title: 'Value',
			body: 'Value is what the condition actually matches against. For Release Title, Release Group, and Edition you pick a reusable regex pattern managed on the Regular Expressions page, which means one pattern can power many custom formats. For the other types you pick from a dropdown or enter a numeric range.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'cf-conditions-modifiers',
			target: 'cf-cond-flags-modifiers',
			title: 'Required & Negate',
			body: "Required switches the logic within a type from OR to AND, so every Required condition of that type must match. Negate inverts a single condition so it matches when the pattern is absent rather than present. Together they cover the 'must have all of these' and 'must not have this' cases.",
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'cf-conditions-arr',
			target: 'cf-cond-flags-arr',
			title: 'Radarr & Sonarr',
			body: 'Radarr and Sonarr toggle which apps this condition applies to. Some metadata (Edition, Quality Modifier) only exists in Radarr; Release Type only exists in Sonarr. For everything else you can keep both on to share one condition across movies and series, or split it if the two apps need different rules.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'cf-conditions-summary',
			title: 'Summary',
			body: 'Each condition pairs a type with a value. Required and Negate flip the matching logic, and the Radarr/Sonarr toggles scope it per app. Stack conditions to narrow a format down to exactly the releases you want, then head to Testing to verify it.',
			completion: { type: 'manual' }
		}
	]
};
