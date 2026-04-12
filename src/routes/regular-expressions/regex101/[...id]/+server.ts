import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$logger/logger.ts';
import { regex101CacheQueries } from '$db/queries/regex101Cache.ts';
import { config } from '$config';
import type { Regex101UnitTest, Regex101Response } from '../types';

/**
 * Run regex tests using the parser service (.NET regex engine)
 */
async function runRegexTests(
	pattern: string,
	tests: Regex101UnitTest[]
): Promise<Regex101UnitTest[]> {
	if (tests.length === 0) return tests;

	try {
		// Call parser service for each test
		const results = await Promise.all(
			tests.map(async (test) => {
				try {
					const response = await fetch(`${config.parserUrl}/match`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							text: test.testString,
							patterns: [pattern]
						})
					});

					if (!response.ok) {
						await logger.warn('Parser match request failed', {
							source: 'Regex101API',
							meta: { status: response.status, testString: test.testString }
						});
						return { ...test };
					}

					const data = await response.json();
					const matched = data.results?.[pattern] ?? false;
					const shouldMatch = test.criteria === 'DOES_MATCH';

					return {
						...test,
						actual: matched,
						passed: matched === shouldMatch
					};
				} catch {
					return { ...test };
				}
			})
		);

		return results;
	} catch (err) {
		await logger.error('Failed to run regex tests', {
			source: 'Regex101API',
			meta: { error: String(err) }
		});
		return tests;
	}
}

export const GET: RequestHandler = async ({ params, fetch }) => {
	// Catch-all route: [...id] captures remaining path segments as a string
	// e.g., /regex101/K6HrsR/4 -> params.id = "K6HrsR/4"
	const { id } = params;

	if (!id) {
		throw error(400, 'Missing regex101 ID');
	}

	// Check cache first
	const cached = regex101CacheQueries.get(id);
	if (cached) {
		return json(JSON.parse(cached.response));
	}

	// Handle ID with optional version (e.g., "ABC123" or "ABC123/1")
	const [regexId, version] = id.split('/');

	try {
		const url = version
			? `https://regex101.com/api/regex/${regexId}/${version}`
			: `https://regex101.com/api/regex/${regexId}`;

		const response = await fetch(url, {
			headers: {
				Accept: 'application/json',
				'User-Agent': 'Profilarr/1.0'
			}
		});

		if (!response.ok) {
			if (response.status === 404) {
				throw error(404, 'Regex not found on regex101');
			}
			throw error(response.status, `Failed to fetch from regex101: ${response.statusText}`);
		}

		const data = await response.json();

		// Extract unit tests
		const unitTests: Regex101UnitTest[] = (data.unitTests || []).map(
			(test: Record<string, unknown>) => ({
				description: test.description || '',
				testString: test.testString || '',
				criteria: (test.criteria as string) || 'DOES_MATCH'
			})
		);

		// Run tests through parser service to get pass/fail results
		const testedUnitTests = await runRegexTests(data.regex, unitTests);

		const result: Regex101Response = {
			permalinkFragment: data.permalinkFragment,
			version: data.version,
			regex: data.regex,
			flags: data.flags || '',
			flavor: data.flavor || 'pcre2',
			unitTests: testedUnitTests
		};

		// Cache the result
		regex101CacheQueries.set(id, JSON.stringify(result));

		return json(result);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		throw error(
			500,
			`Failed to fetch regex101 data: ${err instanceof Error ? err.message : 'Unknown error'}`
		);
	}
};
