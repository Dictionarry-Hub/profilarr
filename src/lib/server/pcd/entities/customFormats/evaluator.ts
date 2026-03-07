/**
 * Custom format condition evaluator
 * Evaluates conditions against parsed release titles
 */

import type { ParseResult } from '$lib/server/utils/arr/parser/types.ts';
import {
	QualitySource,
	QualityModifier,
	Resolution,
	ReleaseType,
	Language
} from '$lib/server/utils/arr/parser/types.ts';
import type {
	ConditionData,
	ConditionResult,
	EvaluationResult,
	ParsedInfo,
	CustomFormatWithConditions
} from '$shared/pcd/display.ts';

/**
 * Patterns grouped by condition type — each type matches against different text
 */
export interface PatternsByType {
	title: string[];
	edition: string[];
	releaseGroup: string[];
}

/**
 * Pre-computed pattern match results from the C# parser, keyed by pattern string
 */
export interface PatternMatchMaps {
	title: Map<string, boolean>;
	edition: Map<string, boolean>;
	releaseGroup: Map<string, boolean>;
}

/**
 * Extract unique regex patterns from custom format conditions, grouped by type.
 * Each type's patterns need to be matched against different text:
 * - title patterns → full release title
 * - edition patterns → parsed edition string
 * - releaseGroup patterns → parsed release group string
 */
export function extractPatternsByType(customFormats: CustomFormatWithConditions[]): PatternsByType {
	const title = new Set<string>();
	const edition = new Set<string>();
	const releaseGroup = new Set<string>();

	for (const cf of customFormats) {
		for (const condition of cf.conditions) {
			if (!condition.patterns) continue;
			const target =
				condition.type === 'release_title'
					? title
					: condition.type === 'edition'
						? edition
						: condition.type === 'release_group'
							? releaseGroup
							: null;
			if (!target) continue;
			for (const p of condition.patterns) {
				if (p.pattern) target.add(p.pattern);
			}
		}
	}

	return { title: [...title], edition: [...edition], releaseGroup: [...releaseGroup] };
}

/**
 * Normalize a value for comparison by removing hyphens, spaces, underscores, and lowercasing
 */
function normalize(value: string): string {
	return value.toLowerCase().replace(/[-_\s]/g, '');
}

// Canonical value mappings (matches src/lib/shared/conditions.ts)
const sourceNames: Record<QualitySource, string> = {
	[QualitySource.Unknown]: 'unknown',
	[QualitySource.Cam]: 'cam',
	[QualitySource.Telesync]: 'telesync',
	[QualitySource.Telecine]: 'telecine',
	[QualitySource.Workprint]: 'workprint',
	[QualitySource.DVD]: 'dvd',
	[QualitySource.TV]: 'television',
	[QualitySource.WebDL]: 'webdl',
	[QualitySource.WebRip]: 'webrip',
	[QualitySource.Bluray]: 'bluray'
};

// Display-friendly names for parsed info shown in the UI
const sourceDisplayNames: Record<QualitySource, string> = {
	[QualitySource.Unknown]: 'Unknown',
	[QualitySource.Cam]: 'CAM',
	[QualitySource.Telesync]: 'Telesync',
	[QualitySource.Telecine]: 'Telecine',
	[QualitySource.Workprint]: 'Workprint',
	[QualitySource.DVD]: 'DVD',
	[QualitySource.TV]: 'Television',
	[QualitySource.WebDL]: 'WEB-DL',
	[QualitySource.WebRip]: 'WEBRip',
	[QualitySource.Bluray]: 'Blu-ray'
};

const resolutionNames: Record<Resolution, string> = {
	[Resolution.Unknown]: 'unknown',
	[Resolution.R360p]: '360p',
	[Resolution.R480p]: '480p',
	[Resolution.R540p]: '540p',
	[Resolution.R576p]: '576p',
	[Resolution.R720p]: '720p',
	[Resolution.R1080p]: '1080p',
	[Resolution.R2160p]: '2160p'
};

const modifierNames: Record<QualityModifier, string> = {
	[QualityModifier.None]: 'none',
	[QualityModifier.Regional]: 'regional',
	[QualityModifier.Screener]: 'screener',
	[QualityModifier.RawHD]: 'rawhd',
	[QualityModifier.BRDisk]: 'brdisk',
	[QualityModifier.Remux]: 'remux'
};

const modifierDisplayNames: Record<QualityModifier, string> = {
	[QualityModifier.None]: 'None',
	[QualityModifier.Regional]: 'Regional',
	[QualityModifier.Screener]: 'Screener',
	[QualityModifier.RawHD]: 'Raw-HD',
	[QualityModifier.BRDisk]: 'BR-DISK',
	[QualityModifier.Remux]: 'Remux'
};

const releaseTypeNames: Record<ReleaseType, string> = {
	[ReleaseType.Unknown]: 'unknown',
	[ReleaseType.SingleEpisode]: 'single_episode',
	[ReleaseType.MultiEpisode]: 'multi_episode',
	[ReleaseType.SeasonPack]: 'season_pack'
};

const languageNames: Record<Language, string> = {
	[Language.Unknown]: 'Unknown',
	[Language.English]: 'English',
	[Language.French]: 'French',
	[Language.Spanish]: 'Spanish',
	[Language.German]: 'German',
	[Language.Italian]: 'Italian',
	[Language.Danish]: 'Danish',
	[Language.Dutch]: 'Dutch',
	[Language.Japanese]: 'Japanese',
	[Language.Icelandic]: 'Icelandic',
	[Language.Chinese]: 'Chinese',
	[Language.Russian]: 'Russian',
	[Language.Polish]: 'Polish',
	[Language.Vietnamese]: 'Vietnamese',
	[Language.Swedish]: 'Swedish',
	[Language.Norwegian]: 'Norwegian',
	[Language.Finnish]: 'Finnish',
	[Language.Turkish]: 'Turkish',
	[Language.Portuguese]: 'Portuguese',
	[Language.Flemish]: 'Flemish',
	[Language.Greek]: 'Greek',
	[Language.Korean]: 'Korean',
	[Language.Hungarian]: 'Hungarian',
	[Language.Hebrew]: 'Hebrew',
	[Language.Lithuanian]: 'Lithuanian',
	[Language.Czech]: 'Czech',
	[Language.Hindi]: 'Hindi',
	[Language.Romanian]: 'Romanian',
	[Language.Thai]: 'Thai',
	[Language.Bulgarian]: 'Bulgarian',
	[Language.PortugueseBR]: 'Portuguese (BR)',
	[Language.Arabic]: 'Arabic',
	[Language.Ukrainian]: 'Ukrainian',
	[Language.Persian]: 'Persian',
	[Language.Bengali]: 'Bengali',
	[Language.Slovak]: 'Slovak',
	[Language.Latvian]: 'Latvian',
	[Language.SpanishLatino]: 'Spanish (Latino)',
	[Language.Catalan]: 'Catalan',
	[Language.Croatian]: 'Croatian',
	[Language.Serbian]: 'Serbian',
	[Language.Bosnian]: 'Bosnian',
	[Language.Estonian]: 'Estonian',
	[Language.Tamil]: 'Tamil',
	[Language.Indonesian]: 'Indonesian',
	[Language.Telugu]: 'Telugu',
	[Language.Macedonian]: 'Macedonian',
	[Language.Slovenian]: 'Slovenian',
	[Language.Malayalam]: 'Malayalam',
	[Language.Kannada]: 'Kannada',
	[Language.Albanian]: 'Albanian',
	[Language.Afrikaans]: 'Afrikaans',
	[Language.Marathi]: 'Marathi',
	[Language.Tagalog]: 'Tagalog',
	[Language.Urdu]: 'Urdu',
	[Language.Romansh]: 'Romansh',
	[Language.Mongolian]: 'Mongolian',
	[Language.Georgian]: 'Georgian',
	[Language.Original]: 'Original'
};

/** Reverse lookup: display name → Language enum value */
const languageNameToEnum = new Map<string, Language>(
	Object.entries(languageNames).map(([enumVal, name]) => [name, Number(enumVal) as Language])
);

/** Convert indexer language display names to Language enum values. Unrecognized names are skipped. */
function indexerLanguagesToEnum(names: string[]): Language[] {
	const result: Language[] = [];
	for (const name of names) {
		const enumVal = languageNameToEnum.get(name);
		if (enumVal !== undefined) {
			result.push(enumVal);
		}
	}
	return result;
}

/**
 * Get serializable parsed info for frontend display
 */
export function getParsedInfo(parsed: ParseResult, indexerLangs?: string[]): ParsedInfo {
	const useIndexer = indexerLangs && indexerLangs.length > 0;
	const effectiveLangs = useIndexer ? indexerLanguagesToEnum(indexerLangs) : parsed.languages;

	return {
		source: sourceDisplayNames[parsed.source] || 'Unknown',
		resolution: resolutionNames[parsed.resolution] || 'Unknown',
		modifier: modifierDisplayNames[parsed.modifier] || 'None',
		languages: effectiveLangs.map((l) => languageNames[l] || 'Unknown'),
		languageSource: useIndexer ? 'Indexer' : 'Title',
		releaseGroup: parsed.releaseGroup,
		year: parsed.year,
		edition: parsed.edition,
		releaseType: parsed.episode ? releaseTypeNames[parsed.episode.releaseType] || 'Unknown' : null
	};
}

interface ConditionEvalResult {
	matched: boolean;
	expected: string;
	actual: string;
}

/**
 * Evaluate a single condition against parsed result
 */
function evaluateCondition(
	condition: ConditionData,
	parsed: ParseResult,
	title: string,
	patternMatchMaps: PatternMatchMaps | null,
	indexerLangs?: Language[]
): ConditionEvalResult {
	switch (condition.type) {
		case 'release_title':
			return evaluatePattern(condition, title, patternMatchMaps?.title ?? null);

		case 'language':
			return evaluateLanguage(condition, parsed, indexerLangs);

		case 'source':
			return evaluateSource(condition, parsed);

		case 'resolution':
			return evaluateResolution(condition, parsed);

		case 'quality_modifier':
			return evaluateQualityModifier(condition, parsed);

		case 'release_type':
			return evaluateReleaseType(condition, parsed);

		case 'year':
			return evaluateYear(condition, parsed);

		case 'edition':
			return evaluateEdition(condition, parsed, patternMatchMaps?.edition ?? null);

		case 'release_group':
			return evaluateReleaseGroup(condition, parsed, patternMatchMaps?.releaseGroup ?? null);

		// These require additional data we don't have
		case 'indexer_flag':
			return { matched: false, expected: 'Indexer flags', actual: 'N/A (no indexer data)' };
		case 'size':
			return { matched: false, expected: 'File size range', actual: 'N/A (no file data)' };

		default:
			return { matched: false, expected: 'Unknown', actual: 'Unknown' };
	}
}

/**
 * Evaluate regex pattern against title using pre-computed pattern matches from C# parser
 */
function evaluatePattern(
	condition: ConditionData,
	title: string,
	patternMatches: Map<string, boolean> | null
): ConditionEvalResult {
	if (!condition.patterns || condition.patterns.length === 0) {
		return { matched: false, expected: 'No patterns defined', actual: title };
	}

	const patternStrs = condition.patterns.map((p) => p.pattern);
	const expected = patternStrs.join(' OR ');

	if (!patternMatches) {
		return { matched: false, expected, actual: 'Parser unavailable' };
	}

	for (const pattern of condition.patterns) {
		if (patternMatches.get(pattern.pattern)) {
			return { matched: true, expected, actual: `Matched: ${pattern.pattern}` };
		}
	}
	return { matched: false, expected, actual: 'No match' };
}

/**
 * Evaluate language condition
 */
function evaluateLanguage(
	condition: ConditionData,
	parsed: ParseResult,
	indexerLangs?: Language[]
): ConditionEvalResult {
	if (!condition.languages || condition.languages.length === 0) {
		return { matched: false, expected: 'No languages defined', actual: 'N/A' };
	}

	// Prefer indexer languages when available
	const effectiveLangs = indexerLangs && indexerLangs.length > 0 ? indexerLangs : parsed.languages;

	const langNames = effectiveLangs.map((l) => languageNames[l] || 'Unknown');
	const actual = langNames.length > 0 ? langNames.join(', ') : 'None detected';

	const expectedParts: string[] = [];
	for (const lang of condition.languages) {
		if (lang.except) {
			expectedParts.push(`NOT ${lang.name}`);
		} else {
			expectedParts.push(lang.name);
		}
	}
	const expected = expectedParts.join(' OR ');

	for (const lang of condition.languages) {
		const langEnum = Language[lang.name as keyof typeof Language];
		if (langEnum === undefined) continue;

		const hasLanguage = effectiveLangs.includes(langEnum);

		if (lang.except) {
			if (hasLanguage) return { matched: false, expected, actual };
		} else {
			if (hasLanguage) return { matched: true, expected, actual };
		}
	}

	const onlyExcepts = condition.languages.every((l) => l.except);
	if (onlyExcepts) return { matched: true, expected, actual };

	return { matched: false, expected, actual };
}

/**
 * Evaluate source condition (Bluray, WebDL, etc.)
 */
function evaluateSource(condition: ConditionData, parsed: ParseResult): ConditionEvalResult {
	if (!condition.sources || condition.sources.length === 0) {
		return { matched: false, expected: 'No sources defined', actual: 'N/A' };
	}

	const actual = sourceNames[parsed.source] || 'unknown';
	const expected = condition.sources.join(' OR ');
	const matched = condition.sources.some((s) => normalize(s) === normalize(actual));

	return { matched, expected, actual };
}

/**
 * Evaluate resolution condition
 */
function evaluateResolution(condition: ConditionData, parsed: ParseResult): ConditionEvalResult {
	if (!condition.resolutions || condition.resolutions.length === 0) {
		return { matched: false, expected: 'No resolutions defined', actual: 'N/A' };
	}

	const actual = resolutionNames[parsed.resolution] || 'unknown';
	const expected = condition.resolutions.join(' OR ');
	const matched = condition.resolutions.some((r) => normalize(r) === normalize(actual));

	return { matched, expected, actual };
}

/**
 * Evaluate quality modifier condition (Remux, etc.)
 */
function evaluateQualityModifier(
	condition: ConditionData,
	parsed: ParseResult
): ConditionEvalResult {
	if (!condition.qualityModifiers || condition.qualityModifiers.length === 0) {
		return { matched: false, expected: 'No modifiers defined', actual: 'N/A' };
	}

	const actual = modifierNames[parsed.modifier] || 'none';
	const expected = condition.qualityModifiers.join(' OR ');
	const matched = condition.qualityModifiers.some((m) => normalize(m) === normalize(actual));

	return { matched, expected, actual };
}

/**
 * Evaluate release type condition (single_episode, season_pack, etc.)
 */
function evaluateReleaseType(condition: ConditionData, parsed: ParseResult): ConditionEvalResult {
	if (!condition.releaseTypes || condition.releaseTypes.length === 0) {
		return { matched: false, expected: 'No release types defined', actual: 'N/A' };
	}

	const expected = condition.releaseTypes.join(' OR ');

	if (!parsed.episode) {
		return { matched: false, expected, actual: 'N/A (not a series)' };
	}

	const actual = releaseTypeNames[parsed.episode.releaseType] || 'unknown';
	const matched = condition.releaseTypes.some((t) => normalize(t) === normalize(actual));

	return { matched, expected, actual };
}

/**
 * Evaluate year condition
 */
function evaluateYear(condition: ConditionData, parsed: ParseResult): ConditionEvalResult {
	if (!condition.years) {
		return { matched: false, expected: 'No year range defined', actual: 'N/A' };
	}

	const { minYear, maxYear } = condition.years;
	const expectedParts: string[] = [];
	if (minYear !== null) expectedParts.push(`>= ${minYear}`);
	if (maxYear !== null) expectedParts.push(`<= ${maxYear}`);
	const expected = expectedParts.join(' AND ') || 'Any year';

	const year = parsed.year;
	if (!year || year === 0) {
		return { matched: false, expected, actual: 'No year detected' };
	}

	const actual = String(year);

	if (minYear !== null && year < minYear) return { matched: false, expected, actual };
	if (maxYear !== null && year > maxYear) return { matched: false, expected, actual };

	return { matched: true, expected, actual };
}

/**
 * Evaluate edition condition using pre-computed pattern matches from C# parser
 */
function evaluateEdition(
	condition: ConditionData,
	parsed: ParseResult,
	patternMatches: Map<string, boolean> | null
): ConditionEvalResult {
	if (!condition.patterns || condition.patterns.length === 0) {
		return { matched: false, expected: 'No patterns defined', actual: 'N/A' };
	}

	const actual = parsed.edition || 'None detected';
	const patternStrs = condition.patterns.map((p) => p.pattern);
	const expected = patternStrs.join(' OR ');

	if (!parsed.edition) {
		return { matched: false, expected, actual };
	}

	if (!patternMatches) {
		return { matched: false, expected, actual: 'Parser unavailable' };
	}

	for (const pattern of condition.patterns) {
		if (patternMatches.get(pattern.pattern)) {
			return { matched: true, expected, actual };
		}
	}
	return { matched: false, expected, actual };
}

/**
 * Evaluate release group condition using pre-computed pattern matches from C# parser
 */
function evaluateReleaseGroup(
	condition: ConditionData,
	parsed: ParseResult,
	patternMatches: Map<string, boolean> | null
): ConditionEvalResult {
	if (!condition.patterns || condition.patterns.length === 0) {
		return { matched: false, expected: 'No patterns defined', actual: 'N/A' };
	}

	const actual = parsed.releaseGroup || 'None detected';
	const patternStrs = condition.patterns.map((p) => p.pattern);
	const expected = patternStrs.join(' OR ');

	if (!parsed.releaseGroup) {
		return { matched: false, expected, actual };
	}

	if (!patternMatches) {
		return { matched: false, expected, actual: 'Parser unavailable' };
	}

	for (const pattern of condition.patterns) {
		if (patternMatches.get(pattern.pattern)) {
			return { matched: true, expected, actual };
		}
	}
	return { matched: false, expected, actual };
}

/**
 * Evaluate all conditions for a custom format against a parsed release
 *
 * Custom format matching logic (matches Radarr/Sonarr behavior):
 * - Conditions are grouped by type (release_title, resolution, source, etc.)
 * - Between types → AND: every type must pass
 * - Within a type → OR: any condition can satisfy it
 * - Required modifier: turns that type's logic from OR to AND
 *   (if any condition in a type is required, ALL required conditions must pass)
 *
 * @param conditions - The conditions to evaluate
 * @param parsed - The parsed release result
 * @param title - The release title
 * @param patternMatchMaps - Pre-computed pattern matches from C# parser (null if parser unavailable)
 */
export function evaluateCustomFormat(
	conditions: ConditionData[],
	parsed: ParseResult,
	title: string,
	patternMatchMaps: PatternMatchMaps | null,
	indexerLangNames?: string[]
): EvaluationResult {
	// Convert indexer language names to enum values once
	const indexerLangs =
		indexerLangNames && indexerLangNames.length > 0
			? indexerLanguagesToEnum(indexerLangNames)
			: undefined;

	const results: ConditionResult[] = [];

	for (const condition of conditions) {
		const evalResult = evaluateCondition(condition, parsed, title, patternMatchMaps, indexerLangs);
		const passes = condition.negate ? !evalResult.matched : evalResult.matched;

		results.push({
			conditionName: condition.name,
			conditionType: condition.type,
			matched: evalResult.matched,
			required: condition.required,
			negate: condition.negate,
			passes,
			expected: evalResult.expected,
			actual: evalResult.actual
		});
	}

	// Group results by condition type
	const typeGroups = new Map<string, ConditionResult[]>();
	for (const result of results) {
		if (!typeGroups.has(result.conditionType)) {
			typeGroups.set(result.conditionType, []);
		}
		typeGroups.get(result.conditionType)!.push(result);
	}

	// Evaluate each type group
	// Between types → AND: every type must pass
	// Within a type:
	//   - If any condition is required: ALL required must pass (AND), optional ignored
	//   - If no conditions are required: at least ONE must pass (OR)
	let allTypesPass = true;

	for (const [, groupResults] of typeGroups) {
		const requiredInGroup = groupResults.filter((r) => r.required);

		let typeGroupPasses: boolean;
		if (requiredInGroup.length > 0) {
			// AND logic: all required conditions must pass
			typeGroupPasses = requiredInGroup.every((r) => r.passes);
		} else {
			// OR logic: at least one condition must pass
			typeGroupPasses = groupResults.some((r) => r.passes);
		}

		if (!typeGroupPasses) {
			allTypesPass = false;
			break;
		}
	}

	return {
		matches: allTypesPass,
		conditions: results
	};
}
