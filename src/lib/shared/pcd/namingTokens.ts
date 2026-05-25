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

export type NamingFormatField =
	| 'movieFormat'
	| 'movieFolderFormat'
	| 'standardEpisodeFormat'
	| 'dailyEpisodeFormat'
	| 'animeEpisodeFormat'
	| 'seriesFolderFormat'
	| 'seasonFolderFormat';

export interface NamingValidationOptions {
	field?: NamingFormatField;
}

export interface ResolveFormatOptions {
	customFormats?: string[];
}

interface ParsedNamingToken {
	raw: string;
	prefix: string;
	suffix: string;
	tokenName: string;
	parameter: string | null;
	canonicalName: string;
}

const TOKEN_PREFIX_REGEX = /^[-\[( ._]*/;
const TOKEN_SUFFIX_REGEX = /[-\]) ._]*$/;

function normalizeTokenName(name: string): string {
	return name.replace(/[\s_\W]/g, '').toLowerCase();
}

function parseTokenContent(raw: string, inner: string): ParsedNamingToken | null {
	const prefix = inner.match(TOKEN_PREFIX_REGEX)?.[0] ?? '';
	const withoutPrefix = inner.slice(prefix.length);
	const suffix = withoutPrefix.match(TOKEN_SUFFIX_REGEX)?.[0] ?? '';
	const tokenWithParameter = withoutPrefix.slice(0, withoutPrefix.length - suffix.length).trim();

	if (!tokenWithParameter || !/^[A-Za-z]/.test(tokenWithParameter)) {
		return null;
	}

	const parameterIndex = tokenWithParameter.indexOf(':');
	const tokenName =
		parameterIndex >= 0
			? tokenWithParameter.slice(0, parameterIndex).trim()
			: tokenWithParameter;
	const parameter = parameterIndex >= 0 ? tokenWithParameter.slice(parameterIndex + 1) : null;

	if (!tokenName || !/^[A-Za-z]/.test(tokenName) || parameter === '') {
		return null;
	}

	return {
		raw,
		prefix,
		suffix,
		tokenName,
		parameter,
		canonicalName: normalizeTokenName(tokenName)
	};
}

function extractNamingTokens(format: string): { tokens: ParsedNamingToken[]; errors: string[] } {
	const errors: string[] = [];
	const tokens: ParsedNamingToken[] = [];

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
		return { tokens, errors };
	}

	const tokenRegex = /\{([^{}]*)\}/g;
	let match;
	while ((match = tokenRegex.exec(format)) !== null) {
		const parsed = parseTokenContent(match[0], match[1]);
		if (!parsed) {
			errors.push(`Invalid token: ${match[0]}`);
			continue;
		}
		tokens.push(parsed);
	}

	return { tokens, errors };
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
		token: '{Movie CollectionThe}',
		description: 'Collection name with leading "The/A/An" moved to the end',
		example: 'Movie Collection, The'
	},
	{
		token: '{Movie CleanCollectionThe}',
		description: 'Clean collection name with leading article moved to the end',
		example: 'Movie Collection, The'
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
	},
	{
		token: '{Quality Proper}',
		description: 'Proper/repack marker when present',
		example: 'Proper'
	},
	{
		token: '{Quality Real}',
		description: 'REAL marker when present',
		example: 'REAL'
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
		token: '{Series TitleWithoutYear}',
		description: 'Series title with trailing year removed',
		example: 'The Series Title'
	},
	{
		token: '{Series CleanTitleWithoutYear}',
		description: 'Clean series title with trailing year removed',
		example: 'The Series Title'
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
		token: '{Series TitleTheYear}',
		description: 'Title with leading article moved to the end and year appended',
		example: 'Series Title, The (2022)'
	},
	{
		token: '{Series CleanTitleTheYear}',
		description: 'Clean title with leading article moved to the end and year appended',
		example: 'Series Title, The 2022'
	},
	{
		token: '{Series TitleTheWithoutYear}',
		description: 'Title with leading article moved to the end and trailing year removed',
		example: 'Series Title, The'
	},
	{
		token: '{Series CleanTitleTheWithoutYear}',
		description: 'Clean title with leading article moved to the end and trailing year removed',
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
	},
	{
		token: '{Quality Proper}',
		description: 'Proper/repack marker when present',
		example: 'Proper'
	},
	{
		token: '{Quality Real}',
		description: 'REAL marker when present',
		example: 'REAL'
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
	},
	{
		token: '{Release Hash}',
		description: 'Anime release hash when present',
		example: 'ABCDEFGH'
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
	'Movie Title:DE': 'Titel des Films',
	'Movie CleanTitle': 'The Movie Title',
	'Movie CleanTitle:DE': 'Titel des Films',
	'Movie TitleThe': 'Movie Title, The',
	'Movie CleanTitleThe': 'Movie Title, The',
	'Movie OriginalTitle': 'Le Titre du Film',
	'Movie CleanOriginalTitle': 'Le Titre du Film',
	'Movie TitleFirstCharacter': 'T',
	'Movie TitleFirstCharacter:DE': 'T',
	'Movie Collection': 'The Movie Collection',
	'Movie CollectionThe': 'Movie Collection, The',
	'Movie CleanCollectionThe': 'Movie Collection, The',
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
	'MediaInfo Video': 'x264',
	'MediaInfo VideoCodec': 'x264',
	'MediaInfo VideoBitDepth': '10',
	'MediaInfo VideoDynamicRange': 'HDR',
	'MediaInfo VideoDynamicRangeType': 'DV HDR10',
	'MediaInfo 3D': '',
	'MediaInfo Audio': 'DTS',
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
	'Series TitleWithoutYear': 'The Series Title',
	'Series CleanTitleWithoutYear': 'The Series Title',
	'Series TitleThe': 'Series Title, The',
	'Series CleanTitleThe': 'Series Title, The',
	'Series TitleTheYear': 'Series Title, The (2022)',
	'Series CleanTitleTheYear': 'Series Title, The 2022',
	'Series TitleTheWithoutYear': 'Series Title, The',
	'Series CleanTitleTheWithoutYear': 'Series Title, The',
	'Series TitleFirstCharacter': 'S',
	'Series Year': '2022',
	ImdbId: 'tt12345',
	TvdbId: '12345',
	TvMazeId: '54321',
	TmdbId: '11223',
	season: '1',
	'season:0': '1',
	'season:00': '01',
	episode: '1',
	'episode:0': '1',
	'episode:00': '01',
	'Air-Date': '2022-03-20',
	'Air Date': '2022 03 20',
	absolute: '1',
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
	'MediaInfo Video': 'x265',
	'MediaInfo VideoCodec': 'x265',
	'MediaInfo VideoBitDepth': '10',
	'MediaInfo VideoDynamicRange': 'HDR',
	'MediaInfo VideoDynamicRangeType': 'DV HDR10',
	'MediaInfo Audio': 'AAC',
	'MediaInfo AudioCodec': 'AAC',
	'MediaInfo AudioChannels': '2.0',
	'MediaInfo AudioLanguages': '[EN]',
	'MediaInfo AudioLanguagesAll': '[EN]',
	'MediaInfo SubtitleLanguages': '[DE]',
	'MediaInfo SubtitleLanguagesAll': '[EN+DE]',
	'Release Group': 'NTb',
	'Release Hash': 'ABCDEFGH',
	'Custom Formats': 'WEBDL-1080p',
	'Original Title': 'The.Series.Title.S01E01.Pilot.Episode.1080p.WEBDL.AAC2.0.x265-NTb',
	'Original Filename': 'The.Series.Title.S01E01.Pilot.Episode.1080p.WEBDL.AAC2.0.x265-NTb'
};

const RADARR_SAMPLE_CUSTOM_FORMATS = ['Surround Sound', 'x264', 'AMZN', 'WEB', 'DV'];
const SONARR_SAMPLE_CUSTOM_FORMATS = ['iNTERNAL', 'AMZN', 'WEB', 'DV'];

// ============================================================================
// RESOLVER
// ============================================================================

const HIDDEN_RADARR_TOKEN_NAMES = ['MediaInfo Video', 'MediaInfo Audio', 'Custom Format'];
const HIDDEN_SONARR_TOKEN_NAMES = ['MediaInfo Video', 'MediaInfo Audio', 'Custom Format'];

const TRUNCATABLE_TOKEN_NAMES = new Set(
	[
		'Movie Title',
		'Movie CleanTitle',
		'Movie TitleThe',
		'Movie CleanTitleThe',
		'Movie OriginalTitle',
		'Movie CleanOriginalTitle',
		'Movie Collection',
		'Movie CollectionThe',
		'Movie CleanCollectionThe',
		'Series Title',
		'Series CleanTitle',
		'Series TitleYear',
		'Series CleanTitleYear',
		'Series TitleWithoutYear',
		'Series CleanTitleWithoutYear',
		'Series TitleThe',
		'Series CleanTitleThe',
		'Series TitleTheYear',
		'Series CleanTitleTheYear',
		'Series TitleTheWithoutYear',
		'Series CleanTitleTheWithoutYear',
		'Series TitleFirstCharacter',
		'Episode Title',
		'Episode CleanTitle',
		'Release Group',
		'Edition Tags'
	].map(normalizeTokenName)
);

const MEDIA_LANGUAGE_TOKEN_NAMES = new Set(
	[
		'MediaInfo Full',
		'MediaInfo AudioLanguages',
		'MediaInfo AudioLanguagesAll',
		'MediaInfo SubtitleLanguages',
		'MediaInfo SubtitleLanguagesAll'
	].map(normalizeTokenName)
);

const SONARR_NUMBER_TOKEN_NAMES = new Set(['season', 'episode', 'absolute'].map(normalizeTokenName));
const RADARR_MOVIE_TITLE_TOKEN_NAMES = new Set(
	[
		'Movie Title',
		'Movie CleanTitle',
		'Movie TitleThe',
		'Movie CleanTitleThe',
		'Movie OriginalTitle',
		'Movie CleanOriginalTitle'
	].map(normalizeTokenName)
);
const RADARR_ORIGINAL_FILE_TOKEN_NAMES = new Set(
	['Original Title', 'Original Filename'].map(normalizeTokenName)
);
const RADARR_MOVIE_FOLDER_DISALLOWED_TOKEN_NAMES = new Set(
	[
		'Original Title',
		'Original Filename',
		'Release Group',
		'Edition Tags',
		'Quality Full',
		'Quality Title',
		'Quality Proper',
		'Quality Real',
		'MediaInfo Video',
		'MediaInfo VideoCodec',
		'MediaInfo VideoBitDepth',
		'MediaInfo Audio',
		'MediaInfo AudioCodec',
		'MediaInfo AudioChannels',
		'MediaInfo AudioLanguages',
		'MediaInfo AudioLanguagesAll',
		'MediaInfo SubtitleLanguages',
		'MediaInfo SubtitleLanguagesAll',
		'MediaInfo 3D',
		'MediaInfo Simple',
		'MediaInfo Full',
		'MediaInfo VideoDynamicRange',
		'MediaInfo VideoDynamicRangeType'
	].map(normalizeTokenName)
);
const SONARR_SERIES_TITLE_TOKEN_NAMES = new Set(
	[
		'Series Title',
		'Series CleanTitle',
		'Series TitleYear',
		'Series CleanTitleYear',
		'Series TitleWithoutYear',
		'Series CleanTitleWithoutYear',
		'Series TitleThe',
		'Series CleanTitleThe',
		'Series TitleTheYear',
		'Series CleanTitleTheYear',
		'Series TitleTheWithoutYear',
		'Series CleanTitleTheWithoutYear'
	].map(normalizeTokenName)
);

function buildSampleLookup(sampleValues: Record<string, string>): Map<string, string> {
	const lookup = new Map<string, string>();
	for (const [key, value] of Object.entries(sampleValues)) {
		lookup.set(normalizeTokenName(key), value);
	}
	return lookup;
}

function getSampleValue(
	token: ParsedNamingToken,
	sampleValues: Record<string, string>,
	lookup: Map<string, string>
): string | undefined {
	if (token.parameter !== null) {
		const parameterSpecific = lookup.get(normalizeTokenName(`${token.tokenName}:${token.parameter}`));
		if (parameterSpecific !== undefined) {
			return parameterSpecific;
		}
	}

	return lookup.get(token.canonicalName) ?? sampleValues[token.tokenName];
}

function truncateValue(value: string, parameter: string | null): string {
	if (parameter === null || !/^-?\d+$/.test(parameter)) {
		return value;
	}

	const maxLength = parseInt(parameter, 10);
	if (maxLength === 0 || value.length <= Math.abs(maxLength)) {
		return value;
	}

	const keepLength = Math.max(Math.abs(maxLength) - 3, 0);
	if (maxLength < 0) {
		return `...${value.slice(value.length - keepLength).replace(/^[ .]+/, '')}`;
	}

	return `${value.slice(0, keepLength).replace(/[ .]+$/, '')}...`;
}

function filterLanguageValue(value: string, parameter: string): string {
	const bracketed = value.match(/^\[([^\]]*)\]$/);
	const languageText = bracketed ? bracketed[1] : value;
	const languages = languageText.split('+').filter(Boolean);
	let filtered = languages;

	if (parameter.startsWith('-')) {
		const excluded = parameter.slice(1).split('-');
		filtered = languages.filter((language) => !excluded.includes(language));
	} else {
		const included = parameter.split('+').filter(Boolean);
		filtered = included.filter((language) => languages.includes(language));
	}

	if (parameter.endsWith('+') && filtered.length !== languages.length) {
		filtered = [...filtered, '--'];
	}

	const result = filtered.join('+');
	return bracketed && result ? `[${result}]` : result;
}

function applyMediaLanguageFilter(value: string, parameter: string | null): string {
	if (!parameter) {
		return value;
	}

	if (value.includes('[')) {
		return value.replace(/\[[^\]]*\]/g, (match) => filterLanguageValue(match, parameter));
	}

	return filterLanguageValue(value, parameter);
}

function getCustomFormats(
	sampleValues: Record<string, string>,
	options: ResolveFormatOptions
): string[] {
	if (options.customFormats) {
		return options.customFormats;
	}

	return (sampleValues['Custom Formats'] ?? '').split(/\s+/).filter(Boolean);
}

function resolveCustomFormatToken(
	token: ParsedNamingToken,
	sampleValues: Record<string, string>,
	options: ResolveFormatOptions
): string {
	const formats = getCustomFormats(sampleValues, options);

	if (token.canonicalName === normalizeTokenName('Custom Format')) {
		if (!token.parameter) {
			return '';
		}

		return formats.find((format) => format === token.parameter) ?? '';
	}

	if (!token.parameter) {
		return sampleValues['Custom Formats'] ?? formats.join(' ');
	}

	if (token.parameter.startsWith('-')) {
		const excluded = token.parameter.slice(1).split(',');
		return formats.filter((format) => !excluded.includes(format)).join(' ');
	}

	const included = token.parameter.split(',');
	return formats.filter((format) => included.includes(format)).join(' ');
}

function resolveNumberToken(value: string, parameter: string | null): string {
	if (!parameter || !/^0+$/.test(parameter)) {
		return value;
	}

	return value.padStart(parameter.length, '0');
}

function resolveTokenValue(
	token: ParsedNamingToken,
	sampleValues: Record<string, string>,
	lookup: Map<string, string>,
	options: ResolveFormatOptions
): string | undefined {
	if (
		token.canonicalName === normalizeTokenName('Custom Format') ||
		token.canonicalName === normalizeTokenName('Custom Formats')
	) {
		return resolveCustomFormatToken(token, sampleValues, options);
	}

	const value = getSampleValue(token, sampleValues, lookup);
	if (value === undefined) {
		return undefined;
	}

	if (SONARR_NUMBER_TOKEN_NAMES.has(token.canonicalName)) {
		return resolveNumberToken(value, token.parameter);
	}

	if (MEDIA_LANGUAGE_TOKEN_NAMES.has(token.canonicalName)) {
		return applyMediaLanguageFilter(value, token.parameter);
	}

	if (TRUNCATABLE_TOKEN_NAMES.has(token.canonicalName)) {
		return truncateValue(value, token.parameter);
	}

	return value;
}

/**
 * Resolve a naming format string by substituting tokens with sample values.
 *
 * Supports:
 * - Basic tokens: {Movie Title} -> "The Movie Title"
 * - Conditional prefix/suffix: {[Quality Full]} -> "[Bluray-1080p Proper]" or "" if empty
 * - Conditional dash: {-Release Group} -> "-EVOLVE" or "" if empty
 */
export function resolveFormat(
	format: string,
	sampleValues: Record<string, string>,
	options: ResolveFormatOptions = {}
): string {
	if (!format) return '';

	const lookup = buildSampleLookup(sampleValues);

	const resolved = format.replace(/\{([^{}]*)\}/g, (match, inner: string) => {
		const parsed = parseTokenContent(match, inner);
		if (!parsed) {
			return match;
		}

		const value = resolveTokenValue(parsed, sampleValues, lookup, options);

		if (value === undefined) {
			return match;
		}

		if (value === '') {
			return '';
		}

		return parsed.prefix + value + parsed.suffix;
	});

	// Clean up double spaces
	return resolved.replace(/  +/g, ' ').trim();
}

export function resolveRadarrFormat(format: string): string {
	return resolveFormat(format, RADARR_SAMPLE_VALUES, { customFormats: RADARR_SAMPLE_CUSTOM_FORMATS });
}

export function resolveSonarrFormat(format: string): string {
	return resolveFormat(format, SONARR_SAMPLE_VALUES, { customFormats: SONARR_SAMPLE_CUSTOM_FORMATS });
}

// ============================================================================
// VALIDATION
// ============================================================================

function addTokenName(names: Map<string, string>, tokenName: string): void {
	names.set(normalizeTokenName(tokenName), tokenName);
}

function getTokenBaseName(token: string): string {
	const inner = token.slice(1, -1);
	const parsed = parseTokenContent(token, inner);
	return parsed?.tokenName ?? inner.trim();
}

/** Build a map of valid token names for an arr type. */
function getValidTokenNames(arrType: 'radarr' | 'sonarr'): Map<string, string> {
	const categories = arrType === 'radarr' ? getRadarrTokenCategories() : getSonarrTokenCategories();
	const names = new Map<string, string>();
	for (const category of categories) {
		for (const t of category.tokens) {
			addTokenName(names, getTokenBaseName(t.token));
		}
	}
	const hiddenNames = arrType === 'radarr' ? HIDDEN_RADARR_TOKEN_NAMES : HIDDEN_SONARR_TOKEN_NAMES;
	for (const name of hiddenNames) {
		addTokenName(names, name);
	}
	return names;
}

function hasToken(tokens: ParsedNamingToken[], names: Set<string>): boolean {
	return tokens.some((token) => names.has(token.canonicalName));
}

function getTokensByName(tokens: ParsedNamingToken[], names: Set<string>): string[] {
	return tokens.filter((token) => names.has(token.canonicalName)).map((token) => token.raw);
}

function addRadarrFieldErrors(
	tokens: ParsedNamingToken[],
	field: NamingFormatField,
	errors: string[]
): void {
	const hasMovieTitle = hasToken(tokens, RADARR_MOVIE_TITLE_TOKEN_NAMES);
	const hasReleaseYear = hasToken(tokens, new Set([normalizeTokenName('Release Year')]));
	const hasOriginalFileToken = hasToken(tokens, RADARR_ORIGINAL_FILE_TOKEN_NAMES);

	if (field === 'movieFormat' && !hasOriginalFileToken && !(hasMovieTitle && hasReleaseYear)) {
		errors.push('Must contain either movie title and release year OR Original Title/Filename');
		return;
	}

	if (field === 'movieFolderFormat') {
		if (!hasMovieTitle) {
			errors.push('Must contain movie title');
		}

		const disallowed = getTokensByName(tokens, RADARR_MOVIE_FOLDER_DISALLOWED_TOKEN_NAMES);
		if (disallowed.length > 0) {
			errors.push(
				`Must not contain deprecated tokens derived from file properties: ${disallowed.join(', ')}`
			);
		}
	}
}

function addSonarrFieldErrors(
	tokens: ParsedNamingToken[],
	field: NamingFormatField,
	errors: string[]
): void {
	const seasonToken = new Set([normalizeTokenName('season')]);
	const episodeToken = new Set([normalizeTokenName('episode')]);
	const absoluteToken = new Set([normalizeTokenName('absolute')]);
	const airDateToken = new Set([normalizeTokenName('Air Date')]);

	const hasSeasonAndEpisode = hasToken(tokens, seasonToken) && hasToken(tokens, episodeToken);
	const hasOriginalFileToken = hasToken(tokens, RADARR_ORIGINAL_FILE_TOKEN_NAMES);

	if (field === 'standardEpisodeFormat' && !hasSeasonAndEpisode && !hasOriginalFileToken) {
		errors.push('Must contain season and episode numbers OR Original Title');
		return;
	}

	if (
		field === 'dailyEpisodeFormat' &&
		!hasToken(tokens, airDateToken) &&
		!hasSeasonAndEpisode &&
		!hasOriginalFileToken
	) {
		errors.push('Must contain Air Date OR Season and Episode OR Original Title');
		return;
	}

	if (
		field === 'animeEpisodeFormat' &&
		!hasToken(tokens, absoluteToken) &&
		!hasSeasonAndEpisode &&
		!hasOriginalFileToken
	) {
		errors.push('Must contain Absolute Episode number OR Season and Episode OR Original Title');
		return;
	}

	if (field === 'seriesFolderFormat' && !hasToken(tokens, SONARR_SERIES_TITLE_TOKEN_NAMES)) {
		errors.push('Must contain series title');
	}

	if (field === 'seasonFolderFormat' && !hasToken(tokens, seasonToken)) {
		errors.push('Must contain season number');
	}
}

/**
 * Validate a naming format string.
 *
 * Checks:
 * 1. Balanced braces - every { has a matching }
 * 2. Known tokens - extracted tokens must be in the valid set
 *
 * Empty format strings are allowed (the form handles "required" separately).
 */
export function validateNamingFormat(
	format: string,
	arrType: 'radarr' | 'sonarr',
	options: NamingValidationOptions = {}
): NamingValidationResult {
	const errors: string[] = [];

	if (!format && !options.field) {
		return { valid: true, errors };
	}

	const extracted = extractNamingTokens(format);
	errors.push(...extracted.errors);

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	const validNames = getValidTokenNames(arrType);
	for (const token of extracted.tokens) {
		if (!validNames.has(token.canonicalName)) {
			errors.push(`Unknown token: {${token.tokenName}}`);
		}
	}

	if (errors.length === 0 && options.field) {
		if (arrType === 'radarr') {
			addRadarrFieldErrors(extracted.tokens, options.field, errors);
		} else {
			addSonarrFieldErrors(extracted.tokens, options.field, errors);
		}
	}

	return {
		valid: errors.length === 0,
		errors
	};
}
