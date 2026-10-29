import { expect, test } from 'vitest';
import {
	getRadarrTokenCategories,
	getSonarrTokenCategories,
	resolveFormat,
	resolveRadarrFormat,
	resolveSonarrFormat,
	validateNamingFormat,
	type NamingFormatField
} from '#shared/pcd/namingTokens.ts';

type ArrType = 'radarr' | 'sonarr';

function assertValid(format: string, arrType: ArrType, field?: NamingFormatField): void {
	const result = validateNamingFormat(format, arrType, field ? { field } : undefined);
	expect(result.valid, `${format}: ${result.errors.join(', ')}`).toStrictEqual(true);
}

function assertInvalid(format: string, arrType: ArrType, field?: NamingFormatField): void {
	const result = validateNamingFormat(format, arrType, field ? { field } : undefined);
	expect(result.valid, `${format} should be invalid`).toStrictEqual(false);
}

function tokensFor(arrType: ArrType): string[] {
	const categories = arrType === 'radarr' ? getRadarrTokenCategories() : getSonarrTokenCategories();
	return categories.flatMap((category) => category.tokens.map((token) => token.token));
}

test('naming tokens validates every advertised Radarr token', () => {
	for (const token of tokensFor('radarr')) {
		assertValid(token, 'radarr');
	}
});

test('naming tokens validates every advertised Sonarr token', () => {
	for (const token of tokensFor('sonarr')) {
		assertValid(token, 'sonarr');
	}
});

test('naming tokens keeps existing default formats valid and previewable', () => {
	assertValid('{Movie Title} ({Release Year}) {Quality Full}', 'radarr', 'movieFormat');
	assertValid('{Movie Title} ({Release Year})', 'radarr', 'movieFolderFormat');
	expect(resolveRadarrFormat('{Movie Title} ({Release Year}) {Quality Full}')).toStrictEqual(
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
	expect(
		resolveSonarrFormat('{Series Title} - S{season:00}E{episode:00} - {Episode Title}')
	).toStrictEqual('The Series Title - S01E01 - Pilot Episode');
});

test('naming tokens preserves current generic validation behavior', () => {
	assertValid('', 'radarr');
	assertValid('{[Quality Full]}{-Release Group}', 'radarr');
	expect(resolveRadarrFormat('{[Quality Full]}{-Release Group}')).toStrictEqual(
		'[Bluray-1080p Proper]-EVOLVE'
	);

	assertInvalid('{Definitely Missing}', 'radarr');
	assertInvalid('{Definitely Missing}', 'sonarr');
	assertInvalid('{Movie Title', 'radarr');
	assertInvalid('Movie Title}', 'radarr');
	assertInvalid('{}', 'radarr');
	assertInvalid('{123}', 'radarr');
});

test('naming tokens normalizes Arr-style token spelling', () => {
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
		expect(resolveRadarrFormat(variant), variant).toStrictEqual(
			resolveRadarrFormat('{Quality Full}')
		);
	}

	assertValid('{Movie.CleanTitle}', 'radarr');
	expect(resolveRadarrFormat('{Movie.CleanTitle}')).toStrictEqual(
		resolveRadarrFormat('{Movie CleanTitle}')
	);
	assertValid('{Series_TitleYear}', 'sonarr');
	expect(resolveSonarrFormat('{Series_TitleYear}')).toStrictEqual(
		resolveSonarrFormat('{Series TitleYear}')
	);
	assertValid('{ReleaseGroup}', 'sonarr');
	expect(resolveSonarrFormat('{ReleaseGroup}')).toStrictEqual(
		resolveSonarrFormat('{Release Group}')
	);

	assertInvalid('{Quality Missing}', 'radarr');
});

test('naming tokens exposes missing picker tokens and keeps aliases silent', () => {
	const radarrTokens = tokensFor('radarr');
	for (const token of [
		'{Movie CollectionThe}',
		'{Movie CleanCollectionThe}',
		'{Quality Proper}',
		'{Quality Real}'
	]) {
		expect(radarrTokens.includes(token), `${token} should be advertised`).toStrictEqual(true);
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
		expect(sonarrTokens.includes(token), `${token} should be advertised`).toStrictEqual(true);
	}

	for (const arrType of ['radarr', 'sonarr'] as const) {
		assertValid('{MediaInfo Video}', arrType);
		assertValid('{MediaInfo Audio}', arrType);
		expect(tokensFor(arrType).includes('{MediaInfo Video}')).toBeFalsy();
		expect(tokensFor(arrType).includes('{MediaInfo Audio}')).toBeFalsy();
	}

	expect(resolveRadarrFormat('{MediaInfo Video} {MediaInfo Audio}')).toStrictEqual('x264 DTS');
	expect(resolveSonarrFormat('{MediaInfo Video} {MediaInfo Audio}')).toStrictEqual('x265 AAC');
});

test('naming tokens validates known parameterized tokens by base token', () => {
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

test('naming tokens previews truncation parameters', () => {
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
		expect(resolveFormat(`{${token}:16}`, sample), token).toStrictEqual('The Fantastic...');
		expect(resolveFormat(`{${token}:-13}`, sample), token).toStrictEqual('...Mr. Sisko');
	}

	expect(resolveFormat('{ReleaseGroup:-17}', sample)).toStrictEqual('...ASixFourImpala');
	expect(resolveFormat('{Release Group:12}', sample)).toStrictEqual('IWishIWas...');
	expect(resolveFormat('{Edition Tags:16}', sample)).toStrictEqual('The Fantastic...');
	expect(resolveFormat('{Movie Title:99}', sample)).toStrictEqual(
		'The Fantastic Life of Mr. Sisko'
	);
});

test('naming tokens previews media language parameters', () => {
	const sample = {
		'MediaInfo AudioLanguages': '[EN+DE+FR]',
		'MediaInfo SubtitleLanguages': '[EN+DE]',
		'MediaInfo Full': 'x264 DTS [EN+DE]'
	};

	expect(resolveFormat('{MediaInfo AudioLanguages:EN+DE}', sample)).toStrictEqual('[EN+DE]');
	expect(resolveFormat('{MediaInfo SubtitleLanguages:-EN}', sample)).toStrictEqual('[DE]');
	expect(resolveFormat('{MediaInfo Full:EN+}', sample)).toStrictEqual('x264 DTS [EN+--]');
});

test('naming tokens previews custom format parameters', () => {
	const sample = { 'Custom Formats': 'AMZN WEB DV Surround Sound' };
	const options = { customFormats: ['AMZN', 'WEB', 'DV', 'Surround Sound'] };

	expect(resolveFormat('{Custom Formats:AMZN,WEB}', sample, options)).toStrictEqual('AMZN WEB');
	expect(resolveFormat('{Custom Formats:-DV}', sample, options)).toStrictEqual(
		'AMZN WEB Surround Sound'
	);
	expect(resolveFormat('{Custom Format:AMZN}', sample, options)).toStrictEqual('AMZN');
	expect(resolveFormat('{Custom Format:amzn}', sample, options)).toStrictEqual('');
	expect(resolveFormat('{Custom Format:Surround Sound}', sample, options)).toStrictEqual(
		'Surround Sound'
	);
});

test('naming tokens validates and previews Sonarr numbering flexibility', () => {
	for (const format of [
		'{season}',
		'{episode}',
		'{absolute}',
		'{season:000}',
		'{episode:000}',
		'{absolute:0000}'
	]) {
		assertValid(format, 'sonarr');
	}

	expect(resolveSonarrFormat('{season}-{episode}-{absolute}')).toStrictEqual('1-1-1');
	expect(resolveSonarrFormat('{season:000}-{episode:000}-{absolute:0000}')).toStrictEqual(
		'001-001-0001'
	);
});

test('naming tokens validates Radarr field rules before Arr sync', () => {
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

test('naming tokens validates Sonarr field rules before Arr sync', () => {
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
