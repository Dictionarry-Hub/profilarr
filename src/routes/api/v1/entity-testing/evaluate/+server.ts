/**
 * API endpoint for parsing and evaluating release titles against custom formats
 * Used by entity testing to get CF matches for scoring
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import {
	parseWithCacheBatch,
	isParserHealthy,
	matchPatternsBatch
} from '$lib/server/utils/arr/parser/index.ts';
import {
	getAllConditionsForEvaluation,
	evaluateCustomFormat,
	getParsedInfo,
	extractPatternsByType
} from '$pcd/entities/customFormats/index.ts';
import type { PatternMatchMaps } from '$pcd/entities/customFormats/index.ts';
import type { components } from '$api/v1.d.ts';

type EvaluateRequest = components['schemas']['EvaluateRequest'];
type EvaluateResponse = components['schemas']['EvaluateResponse'];
type ReleaseEvaluation = components['schemas']['ReleaseEvaluation'];
type MediaType = components['schemas']['MediaType'];

export const POST: RequestHandler = async ({ request }) => {
	const body: EvaluateRequest = await request.json();
	const { databaseId, releases } = body;

	if (!releases || !Array.isArray(releases) || releases.length === 0) {
		throw error(400, 'Missing or empty releases array');
	}

	// Check parser health
	const parserAvailable = await isParserHealthy();
	if (!parserAvailable) {
		return json({
			parserAvailable: false,
			evaluations: releases.map((r) => ({
				releaseId: r.id,
				title: r.title,
				cfMatches: {}
			}))
		} satisfies EvaluateResponse);
	}

	// Parse all releases in batch (uses cache)
	const parseItems = releases.map((r) => ({ title: r.title, type: r.type }));
	const parseResults = await parseWithCacheBatch(parseItems);

	// If no databaseId, just return parsed info without CF evaluation
	if (!databaseId) {
		const evaluations: ReleaseEvaluation[] = releases.map((release) => {
			const cacheKey = `${release.title}:${release.type}`;
			const parsed = parseResults.get(cacheKey);

			return {
				releaseId: release.id,
				title: release.title,
				parsed: parsed ? getParsedInfo(parsed, release.languages) : undefined,
				cfMatches: {}
			};
		});

		return json({
			parserAvailable: true,
			evaluations
		} satisfies EvaluateResponse);
	}

	// Get the PCD cache for CF evaluation
	const cache = pcdManager.getCache(databaseId);
	if (!cache) {
		throw error(404, 'Database not found or cache not available');
	}

	// Get all custom formats with conditions
	const customFormats = await getAllConditionsForEvaluation(cache);

	// Extract patterns grouped by condition type
	const patternsByType = extractPatternsByType(customFormats);
	const releaseTitles = releases.map((r) => r.title);

	// Collect unique edition and releaseGroup values from parsed results
	const editionTexts = new Set<string>();
	const releaseGroupTexts = new Set<string>();
	for (const release of releases) {
		const parsed = parseResults.get(`${release.title}:${release.type}`);
		if (parsed?.edition) editionTexts.add(parsed.edition);
		if (parsed?.releaseGroup) releaseGroupTexts.add(parsed.releaseGroup);
	}

	// Match patterns against their respective texts in parallel via C# parser
	const [titleMatches, editionMatches, rgMatches] = await Promise.all([
		patternsByType.title.length > 0
			? matchPatternsBatch(releaseTitles, patternsByType.title)
			: Promise.resolve(new Map<string, Map<string, boolean>>()),
		patternsByType.edition.length > 0 && editionTexts.size > 0
			? matchPatternsBatch([...editionTexts], patternsByType.edition)
			: Promise.resolve(new Map<string, Map<string, boolean>>()),
		patternsByType.releaseGroup.length > 0 && releaseGroupTexts.size > 0
			? matchPatternsBatch([...releaseGroupTexts], patternsByType.releaseGroup)
			: Promise.resolve(new Map<string, Map<string, boolean>>())
	]);

	const parserFailed = titleMatches === null || editionMatches === null || rgMatches === null;

	// Evaluate each release against all custom formats
	const evaluations: ReleaseEvaluation[] = releases.map((release) => {
		const cacheKey = `${release.title}:${release.type}`;
		const parsed = parseResults.get(cacheKey);

		if (!parsed) {
			return {
				releaseId: release.id,
				title: release.title,
				cfMatches: {}
			};
		}

		// Build pattern match maps for this release
		const patternMatchMaps: PatternMatchMaps | null = parserFailed
			? null
			: {
					title: titleMatches?.get(release.title) ?? new Map(),
					edition: parsed.edition ? (editionMatches?.get(parsed.edition) ?? new Map()) : new Map(),
					releaseGroup: parsed.releaseGroup
						? (rgMatches?.get(parsed.releaseGroup) ?? new Map())
						: new Map()
				};

		// Evaluate against all custom formats
		const cfMatches: Record<string, boolean> = {};
		for (const cf of customFormats) {
			if (cf.conditions.length === 0) {
				cfMatches[cf.name] = false;
				continue;
			}

			const result = evaluateCustomFormat(
				cf.conditions,
				parsed,
				release.title,
				patternMatchMaps,
				release.languages
			);
			cfMatches[cf.name] = result.matches;
		}

		return {
			releaseId: release.id,
			title: release.title,
			parsed: getParsedInfo(parsed, release.languages),
			cfMatches
		};
	});

	return json({
		parserAvailable: true,
		evaluations
	} satisfies EvaluateResponse);
};
