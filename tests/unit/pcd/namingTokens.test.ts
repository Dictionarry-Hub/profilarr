import { assertEquals, assertFalse } from '@std/assert';
import {
	getRadarrTokenCategories,
	getSonarrTokenCategories,
	resolveFormat,
	resolveRadarrFormat,
	resolveSonarrFormat,
	validateNamingFormat,
	type NamingFormatField
} from '$shared/pcd/namingTokens.ts';

type ArrType = 'radarr' | 'sonarr';

function assertValid(format: string, arrType: ArrType, field?: NamingFormatField): void {
	const result = validateNamingFormat(format, arrType, field ? { field } : undefined);
	assertEquals(result.valid, true, `${format}: ${result.errors.join(', ')}`);
}

function assertInvalid(format: string, arrType: ArrType, field?: NamingFormatField): void {
	const result = validateNamingFormat(format, arrType, field ? { field } : undefined);
	assertEquals(result.valid, false, `${format} should be invalid`);
}

function tokensFor(arrType: ArrType): string[] {
	const categories = arrType === 'radarr' ? getRadarrTokenCategories() : getSonarrTokenCategories();
	return categories.flatMap((category) => category.tokens.map((token) => token.token));
}

Deno.test('naming tokens validates every advertised Radarr token', () => {
	for (const token of tokensFor('radarr')) {
		assertValid(token, 'radarr');
	}
});

Deno.test('naming tokens validates every advertised Sonarr token', () => {
	for (const token of tokensFor('sonarr')) {
		assertValid(token, 'sonarr');
	}
});

Deno.test('naming tokens keeps existing default formats valid and previewable', () => {
	assertValid('{Movie Title} ({Release Year}) {Quality Full}', 'radarr', 'movieFormat');
	assertValid('{Movie Title} ({Release Year})', 'radarr', 'movieFolderFormat');
	assertEquals(
		resolveRadarrFormat('{Movie Title} ({Release Year}) {Quality Full}'),
		'The Movie Title (2010) Bluray-1080p Proper'
	);

	assertValid(
		'{Series Title} - S{season:00}E{episode:00} - {Episode Title} {Quality Full}',
		'sonarr',
		'standardEpisodeFormat'
	);
	assertValid(
		'{Series Title} - {Air-Date} - {Episode Title} {Quality Full}',
		'sonarr',
		'dailyEpisodeFormat'
	);
	assertValid(
		'{Series Title} - S{season:00}E{episode:00} - {Episode Title} {Quality Full}',
		'sonarr',
		'animeEpisodeFormat'
	);
	assertValid('{Series Title}', 'sonarr', 'seriesFolderFormat');
	assertValid('Season {season}', 'sonarr', 'seasonFolderFormat');
	assertEquals(
		resolveSonarrFormat('{Series Title} - S{season:00}E{episode:00} - {Episode Title}'),
		'The Series Title - S01E01 - Pilot Episode'
	);
});

Deno.test('naming tokens preserves current generic validation behavior', () => {
	assertValid('', 'radarr');
	assertValid('{[Quality Full]}{-Release Group}', 'radarr');
	assertEquals(resolveRadarrFormat('{[Quality Full]}{-Release Group}'), '[Bluray-1080p Proper]-EVOLVE');

	assertInvalid('{Definitely Missing}', 'radarr');
	assertInvalid('{Definitely Missing}', 'sonarr');
	assertInvalid('{Movie Title', 'radarr');
	assertInvalid('Movie Title}', 'radarr');
	assertInvalid('{}', 'radarr');
	assertInvalid('{123}', 'radarr');
});

Deno.test('naming tokens normalizes Arr-style token spelling', () => {
	const variants = [
		'{Quality Full}',
		'{Quality.Full}',
		'{Quality_Full}',
		'{Quality-Full}',
		'{QualityFull}',
		'{quality full}',
		'{QUALITY FULL}'
	];

	for (const variant of variants) {
		assertValid(variant, 'radarr');
		assertEquals(resolveRadarrFormat(variant), resolveRadarrFormat('{Quality Full}'), variant);
	}

	assertValid('{Movie.CleanTitle}', 'radarr');
	assertEquals(resolveRadarrFormat('{Movie.CleanTitle}'), resolveRadarrFormat('{Movie CleanTitle}'));
	assertValid('{Series_TitleYear}', 'sonarr');
	assertEquals(resolveSonarrFormat('{Series_TitleYear}'), resolveSonarrFormat('{Series TitleYear}'));
	assertValid('{ReleaseGroup}', 'sonarr');
	assertEquals(resolveSonarrFormat('{ReleaseGroup}'), resolveSonarrFormat('{Release Group}'));

	assertInvalid('{Quality Missing}', 'radarr');
});

Deno.test('naming tokens exposes missing picker tokens and keeps aliases silent', () => {
	const radarrTokens = tokensFor('radarr');
	for (const token of [
		'{Movie CollectionThe}',
		'{Movie CleanCollectionThe}',
		'{Quality Proper}',
		'{Quality Real}'
	]) {
		assertEquals(radarrTokens.includes(token), true, `${token} should be advertised`);
	}

	const sonarrTokens = tokensFor('sonarr');
	for (const token of [
		'{Series TitleWithoutYear}',
		'{Series CleanTitleWithoutYear}',
		'{Series TitleTheYear}',
		'{Series CleanTitleTheYear}',
		'{Series TitleTheWithoutYear}',
		'{Series CleanTitleTheWithoutYear}',
		'{Release Hash}',
		'{Quality Proper}',
		'{Quality Real}'
	]) {
		assertEquals(sonarrTokens.includes(token), true, `${token} should be advertised`);
	}

	for (const arrType of ['radarr', 'sonarr'] as const) {
		assertValid('{MediaInfo Video}', arrType);
		assertValid('{MediaInfo Audio}', arrType);
		assertFalse(tokensFor(arrType).includes('{MediaInfo Video}'));
		assertFalse(tokensFor(arrType).includes('{MediaInfo Audio}'));
	}

	assertEquals(resolveRadarrFormat('{MediaInfo Video} {MediaInfo Audio}'), 'x264 DTS');
	assertEquals(resolveSonarrFormat('{MediaInfo Video} {MediaInfo Audio}'), 'x265 AAC');
});

Deno.test('naming tokens validates known parameterized tokens by base token', () => {
	const commonLanguageCodes = ['de', 'DE', 'fr', 'FR', 'es', 'it', 'ja', 'pt-BR'];

	for (const code of commonLanguageCodes) {
		assertValid(`{Movie Title:${code}}`, 'radarr');
		assertValid(`{Movie CleanTitle:${code}}`, 'radarr');
		assertValid(`{Movie TitleFirstCharacter:${code}}`, 'radarr');
	}

	for (const format of [
		'{Series Title:16}',
		'{Movie Title:DE}',
		'{Movie CleanTitle:de}',
		'{MediaInfo AudioLanguages:EN+DE}',
		'{Custom Format:AMZN}',
		'{ReleaseGroup:-17}'
	]) {
		assertValid(format, format.includes('Movie') ? 'radarr' : 'sonarr');
	}

	assertInvalid('{Series Missing:16}', 'sonarr');
	assertInvalid('{Movie Missing:DE}', 'radarr');
	assertInvalid('{:-bad}', 'radarr');
});

Deno.test('naming tokens previews truncation parameters', () => {
	const truncatableTokens = [
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
		'Episode CleanTitle'
	];
	const sample = {
		...Object.fromEntries(
			truncatableTokens.map((token) => [token, 'The Fantastic Life of Mr. Sisko'])
		),
		'Release Group':
			'IWishIWasALittleBitTallerIWishIWasABallerIWishIHadAGirlWhoLookedGoodIWouldCallHerIWishIHadARabbitInAHatWithABatAndASixFourImpala',
		'Edition Tags': 'The Fantastic Life of Mr. Sisko'
	};

	for (const token of truncatableTokens) {
		assertEquals(resolveFormat(`{${token}:16}`, sample), 'The Fantastic...', token);
		assertEquals(resolveFormat(`{${token}:-13}`, sample), '...Mr. Sisko', token);
	}

	assertEquals(resolveFormat('{ReleaseGroup:-17}', sample), '...ASixFourImpala');
	assertEquals(resolveFormat('{Release Group:12}', sample), 'IWishIWas...');
	assertEquals(resolveFormat('{Edition Tags:16}', sample), 'The Fantastic...');
	assertEquals(resolveFormat('{Movie Title:99}', sample), 'The Fantastic Life of Mr. Sisko');
});

Deno.test('naming tokens previews media language parameters', () => {
	const sample = {
		'MediaInfo AudioLanguages': '[EN+DE+FR]',
		'MediaInfo SubtitleLanguages': '[EN+DE]',
		'MediaInfo Full': 'x264 DTS [EN+DE]'
	};

	assertEquals(resolveFormat('{MediaInfo AudioLanguages:EN+DE}', sample), '[EN+DE]');
	assertEquals(resolveFormat('{MediaInfo SubtitleLanguages:-EN}', sample), '[DE]');
	assertEquals(resolveFormat('{MediaInfo Full:EN+}', sample), 'x264 DTS [EN+--]');
});

Deno.test('naming tokens previews custom format parameters', () => {
	const sample = { 'Custom Formats': 'AMZN WEB DV Surround Sound' };
	const options = { customFormats: ['AMZN', 'WEB', 'DV', 'Surround Sound'] };

	assertEquals(resolveFormat('{Custom Formats:AMZN,WEB}', sample, options), 'AMZN WEB');
	assertEquals(resolveFormat('{Custom Formats:-DV}', sample, options), 'AMZN WEB Surround Sound');
	assertEquals(resolveFormat('{Custom Format:AMZN}', sample, options), 'AMZN');
	assertEquals(resolveFormat('{Custom Format:amzn}', sample, options), '');
	assertEquals(resolveFormat('{Custom Format:Surround Sound}', sample, options), 'Surround Sound');
});

Deno.test('naming tokens validates and previews Sonarr numbering flexibility', () => {
	for (const format of ['{season}', '{episode}', '{absolute}', '{season:000}', '{episode:000}', '{absolute:0000}']) {
		assertValid(format, 'sonarr');
	}

	assertEquals(resolveSonarrFormat('{season}-{episode}-{absolute}'), '1-1-1');
	assertEquals(resolveSonarrFormat('{season:000}-{episode:000}-{absolute:0000}'), '001-001-0001');
});

Deno.test('naming tokens validates Radarr field rules before Arr sync', () => {
	assertValid('{Movie Title} ({Release Year}) {Quality Full}', 'radarr', 'movieFormat');
	assertValid('{Movie.CleanTitle:16} ({Release.Year})', 'radarr', 'movieFormat');
	assertValid('{Original Title}', 'radarr', 'movieFormat');
	assertValid('{Original Filename}', 'radarr', 'movieFormat');
	assertInvalid('{Movie Title} {Quality Full}', 'radarr', 'movieFormat');
	assertInvalid('{Release Year} {Quality Full}', 'radarr', 'movieFormat');

	assertValid('{Movie Title} ({Release Year})', 'radarr', 'movieFolderFormat');
	assertValid('{Movie.CleanTitleThe}', 'radarr', 'movieFolderFormat');
	assertInvalid('{Release Year}', 'radarr', 'movieFolderFormat');
	for (const token of [
		'{Original Title}',
		'{Original Filename}',
		'{Release Group}',
		'{Edition Tags}',
		'{Quality Full}',
		'{Quality Proper}',
		'{MediaInfo VideoCodec}',
		'{MediaInfo AudioLanguages}'
	]) {
		assertInvalid(`{Movie Title} ${token}`, 'radarr', 'movieFolderFormat');
	}
});

Deno.test('naming tokens validates Sonarr field rules before Arr sync', () => {
	assertValid('S{season:00}E{episode:00}', 'sonarr', 'standardEpisodeFormat');
	assertValid('{Original Title}', 'sonarr', 'standardEpisodeFormat');
	assertInvalid('{Series Title} - {Episode Title}', 'sonarr', 'standardEpisodeFormat');

	assertValid('{Air-Date}', 'sonarr', 'dailyEpisodeFormat');
	assertValid('{Air.Date}', 'sonarr', 'dailyEpisodeFormat');
	assertValid('S{season}E{episode}', 'sonarr', 'dailyEpisodeFormat');
	assertValid('{Original Filename}', 'sonarr', 'dailyEpisodeFormat');
	assertInvalid('{Series Title} - {Episode Title}', 'sonarr', 'dailyEpisodeFormat');

	assertValid('{absolute:000}', 'sonarr', 'animeEpisodeFormat');
	assertValid('S{season:00}E{episode:00}', 'sonarr', 'animeEpisodeFormat');
	assertValid('{Original Title}', 'sonarr', 'animeEpisodeFormat');
	assertInvalid('{Series Title} - {Episode Title}', 'sonarr', 'animeEpisodeFormat');

	assertValid('{Series Title}', 'sonarr', 'seriesFolderFormat');
	assertValid('{Series.TitleTheWithoutYear}', 'sonarr', 'seriesFolderFormat');
	assertInvalid('{Series Year}', 'sonarr', 'seriesFolderFormat');

	assertValid('Season {season}', 'sonarr', 'seasonFolderFormat');
	assertValid('Season {season:000}', 'sonarr', 'seasonFolderFormat');
	assertInvalid('Season', 'sonarr', 'seasonFolderFormat');
});
