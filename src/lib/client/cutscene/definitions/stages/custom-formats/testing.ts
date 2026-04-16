import type { Stage } from '$cutscene/types.ts';

export const cfTestingStage: Stage = {
	id: 'cf-testing',
	name: 'Testing',
	description: 'Verify a custom format against real release titles',
	prerequisites: [
		{
			check: 'hasDevDatabase',
			message:
				'You need at least one development database (a database with a personal access token and local ops disabled) to start this stage. Testing is only editable on databases you own.'
		},
		{
			check: 'parserHealthy',
			message:
				'The parser service is not running. Start the Profilarr parser microservice so test results can be evaluated before running this stage.'
		}
	],
	steps: [
		{
			id: 'cf-testing-intro',
			route: { resolve: 'firstDevCustomFormatTesting' },
			title: 'Testing',
			body: 'Tests let you feed a release title into a custom format and see whether it matches, along with the parsed metadata and per-condition breakdown. Regex is easy to get subtly wrong, so tests are the safety net that proves a format does what you intended before it ends up in a quality profile. This tab is editable on development databases; other databases show tests read-only.',
			completion: { type: 'manual' }
		},
		{
			id: 'cf-testing-add',
			target: 'cf-testing-add',
			title: 'Add a Test',
			body: 'Click Add Test to open a blank test form. Each test pins a release title to an expected outcome, which is how you lock in regressions as the format evolves.',
			position: 'below-left',
			completion: { type: 'click' }
		},
		{
			id: 'cf-testing-title',
			target: 'cf-test-title',
			title: 'Release Title',
			body: 'The release title is what gets parsed and matched against the format. Paste a real release name (for example, Movie.Name.2024.1080p.BluRay.x264-GROUP) rather than a paraphrased one, since small differences in the string can change how the parser extracts source, resolution, and group.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'cf-testing-type',
			target: 'cf-test-type',
			title: 'Media Type',
			body: 'Movie and Series tell the parser which naming conventions to apply. Series releases expose season and episode metadata and release types that movies do not, so picking the wrong type can change what the format sees. Match the type to where the release would actually come from.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'cf-testing-expected',
			target: 'cf-test-expected',
			title: 'Expected Result',
			body: "Expected Result is your assertion: should this title match the format or not? Pass means the parsed metadata matches and the actual outcome equals the expected one. Include both positive cases (titles that should match) and negative ones (titles that look close but shouldn't) to catch regex drift in both directions.",
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'cf-testing-description',
			target: 'cf-test-description',
			title: 'Description',
			body: 'Description is optional context for a test case: what edge case it covers, which bug it guards against, or which real-world release it came from. It is never used for matching, only for you and anyone else reading the test list later.',
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'cf-testing-summary',
			title: 'Summary',
			body: 'Tests turn a custom format from something that looks right into something you can prove is right. Build up a small set of tests covering the matches you expect and the near-misses you want to avoid, and rerun them whenever the format or its patterns change.',
			completion: { type: 'manual' }
		}
	]
};
