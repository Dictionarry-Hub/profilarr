/**
 * Parser Service Client
 * Calls the C# parser microservice with optional caching
 */

import { config } from '$config';
import { logger } from '$logger/logger.ts';
import { BaseHttpClient } from '../../http/client.ts';
import { parsedReleaseCacheQueries } from '$db/queries/parsedReleaseCache.ts';
import { patternMatchCacheQueries } from '$db/queries/patternMatchCache.ts';
import {
	QualitySource,
	QualityModifier,
	Language,
	ReleaseType,
	type QualityInfo,
	type ParseResult,
	type Resolution,
	type MediaType
} from './types.ts';

// Cached parser version (fetched once per session)
let cachedParserVersion: string | null = null;

interface EpisodeResponse {
	seriesTitle: string | null;
	seasonNumber: number;
	episodeNumbers: number[];
	absoluteEpisodeNumbers: number[];
	airDate: string | null;
	fullSeason: boolean;
	isPartialSeason: boolean;
	isMultiSeason: boolean;
	isMiniSeries: boolean;
	special: boolean;
	releaseType: string;
}

interface ParseResponse {
	title: string;
	type: MediaType;
	source: string;
	resolution: number;
	modifier: string;
	revision: {
		version: number;
		real: number;
		isRepack: boolean;
	};
	languages: string[];
	releaseGroup: string | null;
	movieTitles: string[];
	year: number;
	edition: string | null;
	imdbId: string | null;
	tmdbId: number;
	hardcodedSubs: string | null;
	releaseHash: string | null;
	episode: EpisodeResponse | null;
}

interface HealthResponse {
	status: string;
	version: string;
}

interface MatchResponse {
	results: Record<string, boolean>;
}

interface BatchMatchResponse {
	results: Record<string, Record<string, boolean>>;
}

/**
 * Parser service HTTP client
 * Extends BaseHttpClient with parser-specific methods
 */
class ParserClient extends BaseHttpClient {
	constructor(baseUrl: string) {
		super(baseUrl, {
			timeout: 30000,
			retries: 2,
			retryDelay: 500
		});
	}

	/**
	 * Parse a release title
	 */
	async parse(title: string, type: MediaType): Promise<ParseResponse> {
		return this.post<ParseResponse>('/parse', { title, type });
	}

	/**
	 * Check health and get version
	 */
	async health(): Promise<HealthResponse> {
		return this.get<HealthResponse>('/health');
	}

	/**
	 * Match patterns against text
	 */
	async match(text: string, patterns: string[]): Promise<MatchResponse> {
		return this.post<MatchResponse>('/match', { text, patterns });
	}

	/**
	 * Match patterns against multiple texts (batch)
	 */
	async matchBatch(texts: string[], patterns: string[]): Promise<BatchMatchResponse> {
		return this.post<BatchMatchResponse>('/match/batch', { texts, patterns });
	}
}

// Singleton client instance - lazy initialized
let parserClient: ParserClient | null = null;

function getClient(): ParserClient {
	if (!parserClient) {
		parserClient = new ParserClient(config.parserUrl);
	}
	return parserClient;
}

/**
 * Parse a release title - returns quality, resolution, modifier, revision, and languages
 * @param title - The release title to parse
 * @param type - The media type: 'movie' or 'series'
 */
export async function parse(title: string, type: MediaType): Promise<ParseResult> {
	const data = await getClient().parse(title, type);

	return {
		title: data.title,
		type: data.type,
		source: QualitySource[data.source as keyof typeof QualitySource] ?? QualitySource.Unknown,
		resolution: data.resolution as Resolution,
		modifier:
			QualityModifier[data.modifier as keyof typeof QualityModifier] ?? QualityModifier.None,
		revision: data.revision,
		languages: data.languages.map((l) => Language[l as keyof typeof Language] ?? Language.Unknown),
		releaseGroup: data.releaseGroup,
		movieTitles: data.movieTitles,
		year: data.year,
		edition: data.edition,
		imdbId: data.imdbId,
		tmdbId: data.tmdbId,
		hardcodedSubs: data.hardcodedSubs,
		releaseHash: data.releaseHash,
		episode: data.episode
			? {
					seriesTitle: data.episode.seriesTitle,
					seasonNumber: data.episode.seasonNumber,
					episodeNumbers: data.episode.episodeNumbers,
					absoluteEpisodeNumbers: data.episode.absoluteEpisodeNumbers,
					airDate: data.episode.airDate,
					fullSeason: data.episode.fullSeason,
					isPartialSeason: data.episode.isPartialSeason,
					isMultiSeason: data.episode.isMultiSeason,
					isMiniSeries: data.episode.isMiniSeries,
					special: data.episode.special,
					releaseType:
						ReleaseType[data.episode.releaseType as keyof typeof ReleaseType] ?? ReleaseType.Unknown
				}
			: null
	};
}

/**
 * Parse quality info from a release title (legacy - use parse() for full results)
 */
export async function parseQuality(title: string, type: MediaType): Promise<QualityInfo> {
	const result = await parse(title, type);
	return {
		source: result.source,
		resolution: result.resolution,
		modifier: result.modifier,
		revision: result.revision
	};
}

// Cached health status to avoid blocking page loads
let cachedHealthStatus: { healthy: boolean; checkedAt: number } | null = null;
const HEALTH_CACHE_TTL = 30000; // 30 seconds

/**
 * Check parser service health (fast, cached)
 * Uses a short timeout and caches results to avoid blocking page loads
 */
export async function isParserHealthy(): Promise<boolean> {
	// Return cached result if fresh
	if (cachedHealthStatus && Date.now() - cachedHealthStatus.checkedAt < HEALTH_CACHE_TTL) {
		return cachedHealthStatus.healthy;
	}

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 3000);

		const response = await fetch(`${config.parserUrl}/health`, {
			signal: controller.signal
		});
		clearTimeout(timeoutId);

		const healthy = response.ok;
		cachedHealthStatus = { healthy, checkedAt: Date.now() };
		return healthy;
	} catch {
		cachedHealthStatus = { healthy: false, checkedAt: Date.now() };
		return false;
	}
}

/**
 * Get the parser version from the health endpoint
 * Caches the version for the session to avoid repeated calls
 */
export async function getParserVersion(): Promise<string | null> {
	if (cachedParserVersion) {
		return cachedParserVersion;
	}

	try {
		const data = await getClient().health();
		cachedParserVersion = data.version;
		return cachedParserVersion;
	} catch (err) {
		await logger.warn('Failed to connect to parser service', {
			source: 'ParserClient',
			meta: { error: err instanceof Error ? err.message : 'Unknown error' }
		});
		return null;
	}
}

/**
 * Clear the cached parser version
 * Call this if you need to re-fetch the version (e.g., after parser restart)
 */
export function clearParserVersionCache(): void {
	cachedParserVersion = null;
}

/**
 * Generate cache key for a release title
 */
function getCacheKey(title: string, type: MediaType): string {
	return `${title}:${type}`;
}

/**
 * Parse a release title with caching
 * First checks the cache, falls back to parser service on miss
 * Automatically handles version invalidation
 *
 * @param title - The release title to parse
 * @param type - The media type: 'movie' or 'series'
 * @returns ParseResult or null if parser unavailable
 */
export async function parseWithCache(title: string, type: MediaType): Promise<ParseResult | null> {
	const parserVersion = await getParserVersion();
	if (!parserVersion) {
		// Parser not available
		return null;
	}

	const cacheKey = getCacheKey(title, type);

	// Check cache first
	const cached = parsedReleaseCacheQueries.get(cacheKey, parserVersion);
	if (cached) {
		return JSON.parse(cached.parsed_result) as ParseResult;
	}

	// Cache miss - parse and store
	try {
		const result = await parse(title, type);

		// Store in cache
		parsedReleaseCacheQueries.set(cacheKey, parserVersion, JSON.stringify(result));

		return result;
	} catch {
		// Parser error
		return null;
	}
}

/**
 * Parse multiple release titles with caching (batch operation)
 * More efficient than calling parseWithCache in a loop
 *
 * @param items - Array of { title, type } to parse
 * @returns Map of cache key to ParseResult (null for failures)
 */
export async function parseWithCacheBatch(
	items: Array<{ title: string; type: MediaType }>
): Promise<Map<string, ParseResult | null>> {
	const results = new Map<string, ParseResult | null>();

	const parserVersion = await getParserVersion();
	if (!parserVersion) {
		// Parser not available - return all nulls
		for (const item of items) {
			results.set(getCacheKey(item.title, item.type), null);
		}
		return results;
	}

	// Separate cached vs uncached
	const uncached: Array<{ title: string; type: MediaType; cacheKey: string }> = [];

	for (const item of items) {
		const cacheKey = getCacheKey(item.title, item.type);
		const cached = parsedReleaseCacheQueries.get(cacheKey, parserVersion);

		if (cached) {
			results.set(cacheKey, JSON.parse(cached.parsed_result) as ParseResult);
		} else {
			uncached.push({ ...item, cacheKey });
		}
	}

	// Parse uncached items in parallel
	if (uncached.length > 0) {
		const parsePromises = uncached.map(async (item) => {
			try {
				const result = await parse(item.title, item.type);
				// Store in cache
				parsedReleaseCacheQueries.set(item.cacheKey, parserVersion, JSON.stringify(result));
				return { cacheKey: item.cacheKey, result };
			} catch {
				return { cacheKey: item.cacheKey, result: null };
			}
		});

		const parsed = await Promise.all(parsePromises);
		for (const { cacheKey, result } of parsed) {
			results.set(cacheKey, result);
		}
	}

	return results;
}

/**
 * Clean up old cache entries from previous parser versions
 * Call this on startup or periodically
 */
export async function cleanupOldCacheEntries(): Promise<number> {
	const parserVersion = await getParserVersion();
	if (!parserVersion) {
		return 0;
	}

	const deleted = parsedReleaseCacheQueries.deleteOldVersions(parserVersion);
	if (deleted > 0) {
		await logger.info(`Cleaned up ${deleted} stale parser cache entries`, {
			source: 'ParserCache',
			meta: { deleted, currentVersion: parserVersion }
		});
	}
	return deleted;
}

/**
 * Match multiple regex patterns against a text string using .NET regex
 * This ensures patterns work exactly as they do in Sonarr/Radarr
 *
 * @param text - The text to match against (e.g., release title)
 * @param patterns - Array of regex patterns to test
 * @returns Map of pattern -> matched (true/false), or null if parser unavailable
 */
export async function matchPatterns(
	text: string,
	patterns: string[]
): Promise<Map<string, boolean> | null> {
	if (patterns.length === 0) {
		return new Map();
	}

	try {
		const data = await getClient().match(text, patterns);
		return new Map(Object.entries(data.results));
	} catch (err) {
		await logger.warn('Failed to connect to parser for pattern matching', {
			source: 'ParserClient',
			meta: { error: err instanceof Error ? err.message : 'Unknown error' }
		});
		return null;
	}
}

/**
 * Compute a hash of patterns for cache invalidation
 * Uses Web Crypto API (built into Deno)
 */
async function hashPatterns(patterns: string[]): Promise<string> {
	const sorted = [...patterns].sort();
	const data = new TextEncoder().encode(sorted.join('\n'));
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
		.slice(0, 16);
}

/**
 * Fetch pattern matches from parser service (no caching)
 */
async function fetchPatternMatches(
	texts: string[],
	patterns: string[]
): Promise<Map<string, Map<string, boolean>> | null> {
	try {
		const data = await getClient().matchBatch(texts, patterns);

		const result = new Map<string, Map<string, boolean>>();
		for (const [text, patternResults] of Object.entries(data.results)) {
			result.set(text, new Map(Object.entries(patternResults)));
		}
		return result;
	} catch (err) {
		await logger.warn('Failed to connect to parser for batch pattern matching', {
			source: 'ParserClient',
			meta: { error: err instanceof Error ? err.message : 'Unknown error' }
		});
		return null;
	}
}

/**
 * Validate a regex pattern using the .NET regex engine
 * Returns { valid, error } or null if parser is offline
 *
 * @param pattern - The regex pattern to validate
 * @returns Validation result or null if parser unavailable
 */
export async function validateRegex(
	pattern: string
): Promise<{ valid: boolean; error?: string } | null> {
	const healthy = await isParserHealthy();
	if (!healthy) return null;

	try {
		const data = await getClient().post<{ valid: boolean; error?: string }>('/validate/regex', {
			pattern
		});
		return data;
	} catch {
		return null;
	}
}

/**
 * Match multiple texts against patterns in a single request with caching
 * Results are cached keyed by title + patterns hash
 * Cache automatically invalidates when patterns change
 *
 * @param texts - Array of texts to match (e.g., release titles)
 * @param patterns - Array of regex patterns to test
 * @returns Map of text -> (pattern -> matched), or null if parser unavailable
 */
export async function matchPatternsBatch(
	texts: string[],
	patterns: string[]
): Promise<Map<string, Map<string, boolean>> | null> {
	if (texts.length === 0 || patterns.length === 0) {
		return new Map();
	}

	// Compute hash of patterns for cache key
	const patternsHash = await hashPatterns(patterns);

	// Check cache for existing results
	const cachedResults = patternMatchCacheQueries.getBatch(texts, patternsHash);
	const results = new Map<string, Map<string, boolean>>();
	const uncachedTexts: string[] = [];

	for (const text of texts) {
		const cached = cachedResults.get(text);
		if (cached) {
			// Parse cached JSON back to Map
			const parsed = JSON.parse(cached) as Record<string, boolean>;
			results.set(text, new Map(Object.entries(parsed)));
		} else {
			uncachedTexts.push(text);
		}
	}

	const cacheHits = texts.length - uncachedTexts.length;

	// If all cached, return immediately
	if (uncachedTexts.length === 0) {
		return results;
	}

	// Fetch uncached results from parser
	const fetchedResults = await fetchPatternMatches(uncachedTexts, patterns);
	if (!fetchedResults) {
		// Parser unavailable - return partial results if any
		if (cacheHits > 0) {
			return results;
		}
		return null;
	}

	// Store new results in cache and add to return map
	const toCache: Array<{ title: string; matchResults: string }> = [];
	for (const [text, patternMatches] of fetchedResults) {
		results.set(text, patternMatches);
		// Convert Map to object for JSON storage
		const obj: Record<string, boolean> = {};
		for (const [pattern, matched] of patternMatches) {
			obj[pattern] = matched;
		}
		toCache.push({ title: text, matchResults: JSON.stringify(obj) });
	}

	// Batch insert into cache
	if (toCache.length > 0) {
		patternMatchCacheQueries.setBatch(toCache, patternsHash);
	}

	return results;
}
