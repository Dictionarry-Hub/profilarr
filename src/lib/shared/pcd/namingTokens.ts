/**
 * Naming Token Definitions, Sample Data, Resolver & Validation
 *
 * Shared between frontend (preview, token reference) and backend (validation).
 * No Svelte/DOM dependencies — pure TypeScript.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface NamingToken {
	token: string;
	description: string;
	example: string;
}

export interface TokenCategory {
	name: string;
	tokens: NamingToken[];
}

export interface NamingValidationResult {
	valid: boolean;
	errors: string[];
}

// ============================================================================
// RADARR TOKEN DEFINITIONS
// ============================================================================

const RADARR_MOVIE_TOKENS: NamingToken[] = [
	{
		token: '{Movie Title}',
		description: 'Full movie title as stored in your library',
		example: 'The Movie Title'
	},
	{
		token: '{Movie CleanTitle}',
		description: 'Title with special characters and diacritics removed',
		example: 'The Movie Title'
	},
	{
		token: '{Movie TitleThe}',
		description: 'Title with leading "The/A/An" moved to the end',
		example: 'Movie Title, The'
	},
	{
		token: '{Movie CleanTitleThe}',
		description: 'Clean title with leading article moved to the end',
		example: 'Movie Title, The'
	},
	{
		token: '{Movie OriginalTitle}',
		description: 'Original title from metadata (may differ from English title)',
		example: 'Le Titre du Film'
	},
	{
		token: '{Movie CleanOriginalTitle}',
		description: 'Original title with special characters removed',
		example: 'Le Titre du Film'
	},
	{
		token: '{Movie TitleFirstCharacter}',
		description: 'First letter of the title (useful for folder sorting)',
		example: 'T'
	},
	{
		token: '{Movie Collection}',
		description: 'Collection the movie belongs to (e.g. "Marvel Cinematic Universe")',
		example: 'The Movie Collection'
	},
	{
		token: '{Movie Certification}',
		description: 'Content rating (e.g. R, PG-13, TV-MA)',
		example: 'R'
	}
];

const RADARR_YEAR_TOKENS: NamingToken[] = [
	{
		token: '{Release Year}',
		description: 'Year the movie was released',
		example: '2010'
	}
];

const RADARR_ID_TOKENS: NamingToken[] = [
	{
		token: '{ImdbId}',
		description: 'IMDb identifier',
		example: 'tt0066921'
	},
	{
		token: '{TmdbId}',
		description: 'The Movie Database identifier',
		example: '345691'
	}
];

const RADARR_QUALITY_TOKENS: NamingToken[] = [
	{
		token: '{Quality Full}',
		description: 'Full quality string including revision (e.g. "Proper")',
		example: 'Bluray-1080p Proper'
	},
	{
		token: '{Quality Title}',
		description: 'Quality name without revision info',
		example: 'Bluray-1080p'
	}
];

const RADARR_MEDIAINFO_TOKENS: NamingToken[] = [
	{
		token: '{MediaInfo Simple}',
		description: 'Video and audio codec in short form',
		example: 'x264 DTS'
	},
	{
		token: '{MediaInfo Full}',
		description: 'Video codec, audio codec, and audio languages',
		example: 'x264 DTS [EN+DE]'
	},
	{
		token: '{MediaInfo VideoCodec}',
		description: 'Video codec name',
		example: 'x264'
	},
	{
		token: '{MediaInfo VideoBitDepth}',
		description: 'Video bit depth (8, 10, or 12)',
		example: '10'
	},
	{
		token: '{MediaInfo VideoDynamicRange}',
		description: 'Dynamic range type (HDR or empty)',
		example: 'HDR'
	},
	{
		token: '{MediaInfo VideoDynamicRangeType}',
		description: 'Specific HDR format (e.g. DV, HDR10, HDR10+)',
		example: 'DV HDR10'
	},
	{
		token: '{MediaInfo 3D}',
		description: '"3D" if the movie is 3D, empty otherwise',
		example: '3D'
	},
	{
		token: '{MediaInfo AudioCodec}',
		description: 'Audio codec name',
		example: 'DTS'
	},
	{
		token: '{MediaInfo AudioChannels}',
		description: 'Audio channel layout',
		example: '5.1'
	},
	{
		token: '{MediaInfo AudioLanguages}',
		description: 'Audio languages (English excluded when it is the only language)',
		example: '[EN+DE]'
	},
	{
		token: '{MediaInfo AudioLanguagesAll}',
		description: 'All audio languages including English',
		example: '[EN+DE]'
	},
	{
		token: '{MediaInfo SubtitleLanguages}',
		description: 'Subtitle languages present in the file',
		example: '[DE]'
	},
	{
		token: '{MediaInfo SubtitleLanguagesAll}',
		description: 'All subtitle languages including English',
		example: '[EN+DE]'
	}
];

const RADARR_RELEASE_TOKENS: NamingToken[] = [
	{
		token: '{Release Group}',
		description: 'Release/scene group name (defaults to "Radarr")',
		example: 'EVOLVE'
	},
	{
		token: '{Edition Tags}',
		description: "Edition information (e.g. IMAX, Director's Cut)",
		example: 'IMAX'
	}
];

const RADARR_CF_TOKENS: NamingToken[] = [
	{
		token: '{Custom Formats}',
		description: 'All applied custom formats that have "Include When Renaming" enabled',
		example: 'Surround Sound x264'
	}
];

const RADARR_ORIGINAL_TOKENS: NamingToken[] = [
	{
		token: '{Original Title}',
		description: 'Original release title as downloaded',
		example: 'The.Movie.Title.2010.1080p.BluRay.DTS.x264-EVOLVE'
	},
	{
		token: '{Original Filename}',
		description: 'Original filename without extension',
		example: 'The.Movie.Title.2010.1080p.BluRay.DTS.x264-EVOLVE'
	}
];

// ============================================================================
// SONARR TOKEN DEFINITIONS
// ============================================================================

const SONARR_SERIES_TOKENS: NamingToken[] = [
	{
		token: '{Series Title}',
		description: 'Full series title as stored in your library',
		example: 'The Series Title'
	},
	{
		token: '{Series CleanTitle}',
		description: 'Title with special characters and diacritics removed',
		example: 'The Series Title'
	},
	{
		token: '{Series TitleYear}',
		description: 'Title with year appended in parentheses',
		example: 'The Series Title (2022)'
	},
	{
		token: '{Series CleanTitleYear}',
		description: 'Clean title with year appended',
		example: 'The Series Title 2022'
	},
	{
		token: '{Series TitleThe}',
		description: 'Title with leading "The/A/An" moved to the end',
		example: 'Series Title, The'
	},
	{
		token: '{Series CleanTitleThe}',
		description: 'Clean title with leading article moved to the end',
		example: 'Series Title, The'
	},
	{
		token: '{Series TitleFirstCharacter}',
		description: 'First letter of the title (useful for folder sorting)',
		example: 'S'
	},
	{
		token: '{Series Year}',
		description: 'Year the series first aired',
		example: '2022'
	}
];

const SONARR_ID_TOKENS: NamingToken[] = [
	{
		token: '{ImdbId}',
		description: 'IMDb identifier',
		example: 'tt12345'
	},
	{
		token: '{TvdbId}',
		description: 'TheTVDB identifier',
		example: '12345'
	},
	{
		token: '{TvMazeId}',
		description: 'TVMaze identifier',
		example: '54321'
	},
	{
		token: '{TmdbId}',
		description: 'The Movie Database identifier',
		example: '11223'
	}
];

const SONARR_SEASON_EPISODE_TOKENS: NamingToken[] = [
	{
		token: '{season:0}',
		description: 'Season number without zero-padding',
		example: '1'
	},
	{
		token: '{season:00}',
		description: 'Season number with zero-padding',
		example: '01'
	},
	{
		token: '{episode:0}',
		description: 'Episode number without zero-padding',
		example: '1'
	},
	{
		token: '{episode:00}',
		description: 'Episode number with zero-padding',
		example: '01'
	}
];

const SONARR_AIR_DATE_TOKENS: NamingToken[] = [
	{
		token: '{Air-Date}',
		description: 'Air date with dashes (for daily shows)',
		example: '2022-03-20'
	},
	{
		token: '{Air Date}',
		description: 'Air date with spaces (for daily shows)',
		example: '2022 03 20'
	}
];

const SONARR_ABSOLUTE_TOKENS: NamingToken[] = [
	{
		token: '{absolute:0}',
		description: 'Absolute episode number without padding (anime)',
		example: '1'
	},
	{
		token: '{absolute:00}',
		description: 'Absolute episode number with 2-digit padding (anime)',
		example: '01'
	},
	{
		token: '{absolute:000}',
		description: 'Absolute episode number with 3-digit padding (anime)',
		example: '001'
	}
];

const SONARR_EPISODE_TITLE_TOKENS: NamingToken[] = [
	{
		token: '{Episode Title}',
		description: 'Episode title as stored in metadata',
		example: 'Pilot Episode'
	},
	{
		token: '{Episode CleanTitle}',
		description: 'Episode title with special characters removed',
		example: 'Pilot Episode'
	}
];

const SONARR_QUALITY_TOKENS: NamingToken[] = [
	{
		token: '{Quality Full}',
		description: 'Full quality string including revision (e.g. "Proper")',
		example: 'WEBDL-1080p'
	},
	{
		token: '{Quality Title}',
		description: 'Quality name without revision info',
		example: 'WEBDL-1080p'
	}
];

const SONARR_MEDIAINFO_TOKENS: NamingToken[] = [
	{
		token: '{MediaInfo Simple}',
		description: 'Video and audio codec in short form',
		example: 'x265 AAC'
	},
	{
		token: '{MediaInfo Full}',
		description: 'Video codec, audio codec, and audio languages',
		example: 'x265 AAC [EN]'
	},
	{
		token: '{MediaInfo VideoCodec}',
		description: 'Video codec name',
		example: 'x265'
	},
	{
		token: '{MediaInfo VideoBitDepth}',
		description: 'Video bit depth (8, 10, or 12)',
		example: '10'
	},
	{
		token: '{MediaInfo VideoDynamicRange}',
		description: 'Dynamic range type (HDR or empty)',
		example: 'HDR'
	},
	{
		token: '{MediaInfo VideoDynamicRangeType}',
		description: 'Specific HDR format (e.g. DV, HDR10, HDR10+)',
		example: 'DV HDR10'
	},
	{
		token: '{MediaInfo AudioCodec}',
		description: 'Audio codec name',
		example: 'AAC'
	},
	{
		token: '{MediaInfo AudioChannels}',
		description: 'Audio channel layout',
		example: '2.0'
	},
	{
		token: '{MediaInfo AudioLanguages}',
		description: 'Audio languages (English excluded when it is the only language)',
		example: '[EN]'
	},
	{
		token: '{MediaInfo AudioLanguagesAll}',
		description: 'All audio languages including English',
		example: '[EN]'
	},
	{
		token: '{MediaInfo SubtitleLanguages}',
		description: 'Subtitle languages present in the file',
		example: '[DE]'
	},
	{
		token: '{MediaInfo SubtitleLanguagesAll}',
		description: 'All subtitle languages including English',
		example: '[EN+DE]'
	}
];

const SONARR_RELEASE_TOKENS: NamingToken[] = [
	{
		token: '{Release Group}',
		description: 'Release/scene group name (defaults to "Sonarr")',
		example: 'NTb'
	}
];

const SONARR_CF_TOKENS: NamingToken[] = [
	{
		token: '{Custom Formats}',
		description: 'All applied custom formats that have "Include When Renaming" enabled',
		example: 'WEBDL-1080p'
	}
];

const SONARR_ORIGINAL_TOKENS: NamingToken[] = [
	{
		token: '{Original Title}',
		description: 'Original release title as downloaded',
		example: 'The.Series.Title.S01E01.Pilot.Episode.1080p.WEBDL.AAC2.0.x265-NTb'
	},
	{
		token: '{Original Filename}',
		description: 'Original filename without extension',
		example: 'The.Series.Title.S01E01.Pilot.Episode.1080p.WEBDL.AAC2.0.x265-NTb'
	}
];

// ============================================================================
// CATEGORIZED TOKEN LISTS
// ============================================================================

export function getRadarrTokenCategories(): TokenCategory[] {
	return [
		{ name: 'Movie', tokens: RADARR_MOVIE_TOKENS },
		{ name: 'Year', tokens: RADARR_YEAR_TOKENS },
		{ name: 'IDs', tokens: RADARR_ID_TOKENS },
		{ name: 'Quality', tokens: RADARR_QUALITY_TOKENS },
		{ name: 'Media Info', tokens: RADARR_MEDIAINFO_TOKENS },
		{ name: 'Release', tokens: RADARR_RELEASE_TOKENS },
		{ name: 'Custom Formats', tokens: RADARR_CF_TOKENS },
		{ name: 'Original', tokens: RADARR_ORIGINAL_TOKENS }
	];
}

export function getSonarrTokenCategories(): TokenCategory[] {
	return [
		{ name: 'Series', tokens: SONARR_SERIES_TOKENS },
		{ name: 'IDs', tokens: SONARR_ID_TOKENS },
		{ name: 'Season & Episode', tokens: SONARR_SEASON_EPISODE_TOKENS },
		{ name: 'Air Date', tokens: SONARR_AIR_DATE_TOKENS },
		{ name: 'Absolute Episode', tokens: SONARR_ABSOLUTE_TOKENS },
		{ name: 'Episode Title', tokens: SONARR_EPISODE_TITLE_TOKENS },
		{ name: 'Quality', tokens: SONARR_QUALITY_TOKENS },
		{ name: 'Media Info', tokens: SONARR_MEDIAINFO_TOKENS },
		{ name: 'Release', tokens: SONARR_RELEASE_TOKENS },
		{ name: 'Custom Formats', tokens: SONARR_CF_TOKENS },
		{ name: 'Original', tokens: SONARR_ORIGINAL_TOKENS }
	];
}

// ============================================================================
// SAMPLE DATA
// ============================================================================

const RADARR_SAMPLE_VALUES: Record<string, string> = {
	'Movie Title': 'The Movie Title',
	'Movie CleanTitle': 'The Movie Title',
	'Movie TitleThe': 'Movie Title, The',
	'Movie CleanTitleThe': 'Movie Title, The',
	'Movie OriginalTitle': 'Le Titre du Film',
	'Movie CleanOriginalTitle': 'Le Titre du Film',
	'Movie TitleFirstCharacter': 'T',
	'Movie Collection': 'The Movie Collection',
	'Movie Certification': 'R',
	'Release Year': '2010',
	ImdbId: 'tt0066921',
	TmdbId: '345691',
	'Quality Full': 'Bluray-1080p Proper',
	'Quality Title': 'Bluray-1080p',
	'Quality Proper': 'Proper',
	'Quality Real': '',
	'MediaInfo Simple': 'x264 DTS',
	'MediaInfo Full': 'x264 DTS [EN+DE]',
	'MediaInfo VideoCodec': 'x264',
	'MediaInfo VideoBitDepth': '10',
	'MediaInfo VideoDynamicRange': 'HDR',
	'MediaInfo VideoDynamicRangeType': 'DV HDR10',
	'MediaInfo 3D': '',
	'MediaInfo AudioCodec': 'DTS',
	'MediaInfo AudioChannels': '5.1',
	'MediaInfo AudioLanguages': '[EN+DE]',
	'MediaInfo AudioLanguagesAll': '[EN+DE]',
	'MediaInfo SubtitleLanguages': '[DE]',
	'MediaInfo SubtitleLanguagesAll': '[EN+DE]',
	'Release Group': 'EVOLVE',
	'Edition Tags': 'IMAX',
	'Custom Formats': 'Surround Sound x264',
	'Original Title': 'The.Movie.Title.2010.1080p.BluRay.DTS.x264-EVOLVE',
	'Original Filename': 'The.Movie.Title.2010.1080p.BluRay.DTS.x264-EVOLVE'
};

const SONARR_SAMPLE_VALUES: Record<string, string> = {
	'Series Title': 'The Series Title',
	'Series CleanTitle': 'The Series Title',
	'Series TitleYear': 'The Series Title (2022)',
	'Series CleanTitleYear': 'The Series Title 2022',
	'Series TitleThe': 'Series Title, The',
	'Series CleanTitleThe': 'Series Title, The',
	'Series TitleFirstCharacter': 'S',
	'Series Year': '2022',
	ImdbId: 'tt12345',
	TvdbId: '12345',
	TvMazeId: '54321',
	TmdbId: '11223',
	'season:0': '1',
	'season:00': '01',
	'episode:0': '1',
	'episode:00': '01',
	'Air-Date': '2022-03-20',
	'Air Date': '2022 03 20',
	'absolute:0': '1',
	'absolute:00': '01',
	'absolute:000': '001',
	'Episode Title': 'Pilot Episode',
	'Episode CleanTitle': 'Pilot Episode',
	'Quality Full': 'WEBDL-1080p',
	'Quality Title': 'WEBDL-1080p',
	'Quality Proper': '',
	'Quality Real': '',
	'MediaInfo Simple': 'x265 AAC',
	'MediaInfo Full': 'x265 AAC [EN]',
	'MediaInfo VideoCodec': 'x265',
	'MediaInfo VideoBitDepth': '10',
	'MediaInfo VideoDynamicRange': 'HDR',
	'MediaInfo VideoDynamicRangeType': 'DV HDR10',
	'MediaInfo AudioCodec': 'AAC',
	'MediaInfo AudioChannels': '2.0',
	'MediaInfo AudioLanguages': '[EN]',
	'MediaInfo AudioLanguagesAll': '[EN]',
	'MediaInfo SubtitleLanguages': '[DE]',
	'MediaInfo SubtitleLanguagesAll': '[EN+DE]',
	'Release Group': 'NTb',
	'Custom Formats': 'WEBDL-1080p',
	'Original Title': 'The.Series.Title.S01E01.Pilot.Episode.1080p.WEBDL.AAC2.0.x265-NTb',
	'Original Filename': 'The.Series.Title.S01E01.Pilot.Episode.1080p.WEBDL.AAC2.0.x265-NTb'
};

// ============================================================================
// RESOLVER
// ============================================================================

/**
 * Resolve a naming format string by substituting tokens with sample values.
 *
 * Supports:
 * - Basic tokens: {Movie Title} → "The Movie Title"
 * - Conditional prefix/suffix: {[Quality Full]} → "[Bluray-1080p Proper]" or "" if empty
 * - Conditional dash: {-Release Group} → "-EVOLVE" or "" if empty
 */
export function resolveFormat(format: string, sampleValues: Record<string, string>): string {
	if (!format) return '';

	// Build case-insensitive lookup map
	const lowerMap = new Map<string, string>();
	for (const [key, val] of Object.entries(sampleValues)) {
		lowerMap.set(key.toLowerCase(), val);
	}

	// Match tokens: {prefix token suffix} where prefix/suffix are optional [ ] - _ . space chars
	const tokenRegex =
		/\{(?<prefix>[-\[( ._]*)(?<token>[A-Za-z][A-Za-z0-9 :+-]*)(?<suffix>[-\]) ._]*)\}/g;

	const resolved = format.replace(
		tokenRegex,
		(_match, prefix: string, token: string, suffix: string) => {
			const trimmedToken = token.trim();
			const value = lowerMap.get(trimmedToken.toLowerCase());

			if (value === undefined) {
				// Unknown token — leave as-is
				return _match;
			}

			if (value === '') {
				// Empty value — strip the whole token including prefix/suffix
				return '';
			}

			return prefix + value + suffix;
		}
	);

	// Clean up double spaces
	return resolved.replace(/  +/g, ' ').trim();
}

export function resolveRadarrFormat(format: string): string {
	return resolveFormat(format, RADARR_SAMPLE_VALUES);
}

export function resolveSonarrFormat(format: string): string {
	return resolveFormat(format, SONARR_SAMPLE_VALUES);
}

// ============================================================================
// VALIDATION
// ============================================================================

/** Build a Set of valid token names (without braces) for an arr type. */
function getValidTokenNames(arrType: 'radarr' | 'sonarr'): Set<string> {
	const categories = arrType === 'radarr' ? getRadarrTokenCategories() : getSonarrTokenCategories();
	const names = new Set<string>();
	for (const category of categories) {
		for (const t of category.tokens) {
			// Strip outer braces and lowercase for case-insensitive matching
			names.add(t.token.slice(1, -1).toLowerCase());
		}
	}
	return names;
}

/**
 * Validate a naming format string.
 *
 * Checks:
 * 1. Balanced braces — every { has a matching }
 * 2. Known tokens — extracted tokens must be in the valid set
 *
 * Empty format strings are allowed (the form handles "required" separately).
 */
export function validateNamingFormat(
	format: string,
	arrType: 'radarr' | 'sonarr'
): NamingValidationResult {
	const errors: string[] = [];

	if (!format) {
		return { valid: true, errors };
	}

	// Check balanced braces
	let depth = 0;
	for (const ch of format) {
		if (ch === '{') depth++;
		if (ch === '}') depth--;
		if (depth < 0) {
			errors.push('Unmatched closing brace "}"');
			break;
		}
	}
	if (depth > 0) {
		errors.push('Unmatched opening brace "{"');
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	// Extract tokens and validate each one
	const validNames = getValidTokenNames(arrType);
	const tokenRegex = /\{[-\[( ._]*([A-Za-z][A-Za-z0-9 :+-]*)[-\]) ._]*\}/g;
	let match;

	while ((match = tokenRegex.exec(format)) !== null) {
		const tokenName = match[1].trim();
		if (!validNames.has(tokenName.toLowerCase())) {
			errors.push(`Unknown token: {${tokenName}}`);
		}
	}

	return {
		valid: errors.length === 0,
		errors
	};
}
