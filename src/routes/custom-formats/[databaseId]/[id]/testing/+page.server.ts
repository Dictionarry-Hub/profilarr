import { error, fail } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import * as customFormatQueries from '$pcd/entities/customFormats/index.ts';
import type { ConditionResult, ParsedInfo } from '$shared/pcd/display.ts';
import { parse, isParserHealthy, matchPatterns } from '$lib/server/utils/arr/parser/client.ts';
import type { MediaType } from '$lib/server/utils/arr/parser/types.ts';
import type { PatternMatchMaps } from '$pcd/entities/customFormats/index.ts';

export type TestResult = 'pass' | 'fail' | 'unknown';

export interface TestWithResult {
	custom_format_name: string;
	title: string;
	type: string;
	should_match: boolean;
	description: string | null;
	/** Whether the format actually matched */
	actual_match: boolean | null;
	/** Test result: pass if actual matches expected, fail if not, unknown if parser unavailable */
	result: TestResult;
	/** Parsed info from the title */
	parsed: ParsedInfo | null;
	/** Condition evaluation results */
	conditions: ConditionResult[];
}

export const load: ServerLoad = async ({ params }) => {
	const { databaseId, id } = params;

	// Validate params exist
	if (!databaseId || !id) {
		throw error(400, 'Missing required parameters');
	}

	// Parse and validate the database ID
	const currentDatabaseId = parseInt(databaseId, 10);
	if (isNaN(currentDatabaseId)) {
		throw error(400, 'Invalid database ID');
	}

	// Parse and validate the format ID
	const formatId = parseInt(id, 10);
	if (isNaN(formatId)) {
		throw error(400, 'Invalid format ID');
	}

	// Get the cache for the database
	const cache = pcdManager.getCache(currentDatabaseId);
	if (!cache) {
		throw error(500, 'Database cache not available');
	}

	// Get custom format basic info
	const format = await customFormatQueries.getById(cache, formatId);
	if (!format) {
		throw error(404, 'Custom format not found');
	}

	// Get tests for this custom format
	const tests = await customFormatQueries.listTests(cache, format.name);

	// Check if parser is available
	const parserAvailable = await isParserHealthy();

	// If no parser or no tests, return early
	if (!parserAvailable || tests.length === 0) {
		const testsWithResults: TestWithResult[] = tests.map((test) => ({
			...test,
			actual_match: null,
			result: 'unknown' as TestResult,
			parsed: null,
			conditions: []
		}));

		return {
			format,
			tests: testsWithResults,
			parserAvailable,
			canWriteToBase: canWriteToBase(currentDatabaseId)
		};
	}

	// Get conditions for evaluation
	const conditions = await customFormatQueries.getConditionsForEvaluation(cache, format.name);

	// Extract patterns by type from this format's conditions
	const titlePatterns = new Set<string>();
	const editionPatterns = new Set<string>();
	const rgPatterns = new Set<string>();
	for (const cond of conditions) {
		if (!cond.patterns) continue;
		const target =
			cond.type === 'release_title'
				? titlePatterns
				: cond.type === 'edition'
					? editionPatterns
					: cond.type === 'release_group'
						? rgPatterns
						: null;
		if (!target) continue;
		for (const p of cond.patterns) {
			if (p.pattern) target.add(p.pattern);
		}
	}
	const uniqueTitle = [...titlePatterns];
	const uniqueEdition = [...editionPatterns];
	const uniqueRg = [...rgPatterns];

	// Evaluate each test
	const testsWithResults: TestWithResult[] = await Promise.all(
		tests.map(async (test) => {
			try {
				// Parse the release title
				const parsedResult = await parse(test.title, test.type as MediaType);

				// Get serializable parsed info
				const parsed = customFormatQueries.getParsedInfo(parsedResult);

				// Match patterns via C# parser
				const [titleMatch, editionMatch, rgMatch] = await Promise.all([
					uniqueTitle.length > 0
						? matchPatterns(test.title, uniqueTitle)
						: Promise.resolve(new Map<string, boolean>()),
					uniqueEdition.length > 0 && parsedResult.edition
						? matchPatterns(parsedResult.edition, uniqueEdition)
						: Promise.resolve(new Map<string, boolean>()),
					uniqueRg.length > 0 && parsedResult.releaseGroup
						? matchPatterns(parsedResult.releaseGroup, uniqueRg)
						: Promise.resolve(new Map<string, boolean>())
				]);

				const parserFailed = titleMatch === null || editionMatch === null || rgMatch === null;

				const patternMatchMaps: PatternMatchMaps | null = parserFailed
					? null
					: {
							title: titleMatch ?? new Map(),
							edition: editionMatch ?? new Map(),
							releaseGroup: rgMatch ?? new Map()
						};

				// Evaluate the custom format conditions
				const evaluation = customFormatQueries.evaluateCustomFormat(
					conditions,
					parsedResult,
					test.title,
					patternMatchMaps
				);

				// Determine if test passes (actual matches expected)
				const actual_match = evaluation.matches;
				const result: TestResult = actual_match === test.should_match ? 'pass' : 'fail';

				return {
					...test,
					actual_match,
					result,
					parsed,
					conditions: evaluation.conditions
				};
			} catch (e) {
				console.error(`Failed to evaluate test "${test.title}":`, e); // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
				return {
					...test,
					actual_match: null,
					result: 'unknown' as TestResult,
					parsed: null,
					conditions: []
				};
			}
		})
	);

	return {
		format,
		tests: testsWithResults,
		parserAvailable,
		canWriteToBase: canWriteToBase(currentDatabaseId)
	};
};

export const actions: Actions = {
	delete: async ({ request, params }) => {
		const { databaseId, id } = params;

		if (!databaseId || !id) {
			return fail(400, { error: 'Missing required parameters' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		if (isNaN(currentDatabaseId)) {
			return fail(400, { error: 'Invalid database ID' });
		}
		if (!canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Entity tests are read-only for this database' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		const formData = await request.formData();
		const formatName = formData.get('formatName') as string;
		const testTitle = formData.get('testTitle') as string;
		const testType = formData.get('testType') as string;
		const layer = (formData.get('layer') as OperationLayer) || 'user';

		if (!formatName) {
			return fail(400, { error: 'Format name is required' });
		}

		if (!testTitle || !testType) {
			return fail(400, { error: 'Test title and type are required' });
		}

		// Get current test for value guards
		const current = await customFormatQueries.getTest(cache, formatName, testTitle, testType);
		if (!current) {
			return fail(404, { error: 'Test not found' });
		}

		// Check layer permission
		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		const result = await customFormatQueries.deleteTest({
			databaseId: currentDatabaseId,
			layer,
			formatName,
			current
		});

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to delete test' });
		}

		return { success: true };
	}
};
