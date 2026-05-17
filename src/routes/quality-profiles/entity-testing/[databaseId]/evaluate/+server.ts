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
	extractPatternsByType,
	filterConditionsForArrType
} from '$pcd/entities/customFormats/index.ts';
import type {
	EvaluationArrType,
	PatternMatchMaps
} from '$pcd/entities/customFormats/index.ts';
import type { EvaluateRequest, EvaluateResponse, ReleaseEvaluation } from '$shared/pcd/display.ts';

function getArrTypeForRelease(type: 'movie' | 'series'): EvaluationArrType {
	return type === 'movie' ? 'radarr' : 'sonarr';
}

export const POST: RequestHandler = async ({ params, request }) => {
	const databaseId = Number(params.databaseId);
	if (!Number.isFinite(databaseId)) {
		throw error(400, 'Invalid databaseId');
	}

	const body: EvaluateRequest = await request.json();
	const { releases } = body;

	if (!releases || !Array.isArray(releases) || releases.length === 0) {
		throw error(400, 'Missing or empty releases array');
	}

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

	const parseItems = releases.map((r) => ({ title: r.title, type: r.type }));
	const parseResults = await parseWithCacheBatch(parseItems);

	const cache = pcdManager.getCache(databaseId);
	if (!cache) {
		throw error(404, 'Database not found or cache not available');
	}

	const customFormats = await getAllConditionsForEvaluation(cache);

	const releaseArrTypes = new Set<EvaluationArrType>(
		releases.map((release) => getArrTypeForRelease(release.type))
	);
	const customFormatsForPatternMatching = customFormats.map((cf) => {
		const conditions = new Set<(typeof cf.conditions)[number]>();
		for (const arrType of releaseArrTypes) {
			for (const condition of filterConditionsForArrType(cf.conditions, arrType)) {
				conditions.add(condition);
			}
		}

		return {
			name: cf.name,
			conditions: [...conditions]
		};
	});

	const patternsByType = extractPatternsByType(customFormatsForPatternMatching);
	const releaseTitles = releases.map((r) => r.title);

	const editionTexts = new Set<string>();
	const releaseGroupTexts = new Set<string>();
	for (const release of releases) {
		const parsed = parseResults.get(`${release.title}:${release.type}`);
		if (parsed?.edition) editionTexts.add(parsed.edition);
		if (parsed?.releaseGroup) releaseGroupTexts.add(parsed.releaseGroup);
	}

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

		const patternMatchMaps: PatternMatchMaps | null = parserFailed
			? null
			: {
					title: titleMatches?.get(release.title) ?? new Map(),
					edition: parsed.edition ? (editionMatches?.get(parsed.edition) ?? new Map()) : new Map(),
					releaseGroup: parsed.releaseGroup
						? (rgMatches?.get(parsed.releaseGroup) ?? new Map())
						: new Map()
				};

		const cfMatches: Record<string, boolean> = {};
		const arrType = getArrTypeForRelease(release.type);
		for (const cf of customFormats) {
			const conditions = filterConditionsForArrType(cf.conditions, arrType);
			if (conditions.length === 0) {
				cfMatches[cf.name] = false;
				continue;
			}

			const result = evaluateCustomFormat(
				conditions,
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
