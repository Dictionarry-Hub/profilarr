import type { Stage } from '$cutscene/types.ts';

export const regexGeneralStage: Stage = {
	id: 'regex-general',
	name: 'General',
	description: 'Reusable regex patterns shared across custom format conditions',
	prerequisites: [
		{
			check: 'hasDatabase',
			message:
				'You need at least one connected database to start this stage. Follow the "Link" stage under Databases from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'regex-intro',
			route: { resolve: 'firstRegularExpression' },
			title: 'Regular Expressions',
			body: 'Regular expressions are reusable patterns that custom format conditions match against. Profilarr keeps them on their own page rather than inlining them in conditions, so the same pattern can power many custom formats and you only update it in one place. Conditions of type Release Title, Release Group, and Edition pick a pattern from this list. The whole regex lives on a single form: identity, the pattern itself, optional regex101 tests, and the conditions that reference it.',
			completion: { type: 'manual' }
		},
		{
			id: 'regex-metadata',
			target: 'regex-metadata',
			title: 'Name, Tags & Description',
			body: 'Name is how conditions select this pattern, so make it descriptive (for example, "Release Group - SPARKS" or "Resolution - 1080p"). Tags group patterns on the list page so you can filter by codec, group, source, and so on once the library grows. Description is a markdown field for notes about what the pattern matches and any quirks worth flagging. None of these affect what the pattern matches; they pay off when you or someone else revisits the pattern later.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'regex-pattern',
			target: 'regex-pattern',
			title: 'The Pattern',
			body: 'The pattern itself, written in the .NET regex flavor. Radarr and Sonarr both compile your pattern with a single flag, IgnoreCase (the i flag), and nothing else, so matching is case-insensitive by default but multiline (m) and singleline (s) modes are off; if you need them, set them inline with (?m) or (?s) in the pattern. The flavor matters because both apps run on .NET 6+, so a pattern that works in PCRE, Python, or JavaScript may behave differently here. As you type, Profilarr pings the parser microservice for live validation: Valid means the pattern compiles, Invalid surfaces the .NET error, and Parser unavailable means the parser is offline (the pattern still saves, just without the safety check).',
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'regex-tests',
			target: 'regex101-id',
			title: 'Regex101 Tests',
			body: 'Regex101 ID is an optional pointer to a saved pattern on regex101.com (for example, "GMV8jd/1" includes the version number, which keeps tests pinned to a specific revision). When set, Profilarr fetches the unit tests from regex101 and runs them through the parser against your pattern, surfacing pass/fail per test below. Set the regex101 entry to the .NET flavor with the i flag so the tests reflect what Radarr and Sonarr will actually do.',
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'regex-references',
			target: 'regex-references',
			title: 'References',
			body: 'References lists every custom format condition that selects this pattern, with badges for Negate and Required. Because patterns are shared, a single edit can ripple across many formats and across both Radarr and Sonarr; this view is the quick check for what you are about to change before you save.',
			position: 'above',
			completion: { type: 'manual' }
		},
		{
			id: 'regex-summary',
			title: 'Summary',
			body: 'A regex in Profilarr is a named, .NET-flavored pattern with optional regex101 tests and a list of the conditions that consume it. The reuse is the point: write a pattern once, test it once, then lean on it from every custom format that needs the same match.',
			completion: { type: 'manual' }
		}
	]
};
