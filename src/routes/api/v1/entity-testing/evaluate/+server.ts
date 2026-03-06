/**
 * API endpoint for parsing and evaluating release titles against custom formats
 * Used by entity testing to get CF matches for scoring
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pcdManager } from '$pcd/index.ts';
import {
	parseWithCacheBatch,
	isParserHealthy,
	matchPatternsBatch
} from '$lib/server/utils/arr/parser/index.ts';
import {
	getAllConditionsForEvaluation,
	evaluateCustomFormat,
	getParsedInfo,
	extractAllPatterns
} from '$pcd/entities/customFormats/index.ts';
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

	// Extract all unique patterns and match them against all release titles (with caching)
	const allPatterns = extractAllPatterns(customFormats);
	const releaseTitles = releases.map((r) => r.title);
	const patternMatchResults = await matchPatternsBatch(releaseTitles, allPatterns);

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

		// Get pattern matches for this release title
		const patternMatches = patternMatchResults?.get(release.title);

		// Evaluate against all custom formats
		const cfMatches: Record<string, boolean> = {};
		for (const cf of customFormats) {
			if (cf.conditions.length === 0) {
				// No conditions = doesn't match
				cfMatches[cf.name] = false;
				continue;
			}

			const result = evaluateCustomFormat(
				cf.conditions,
				parsed,
				release.title,
				patternMatches,
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
