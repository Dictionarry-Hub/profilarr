import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import {
	compareMediaManagementDrift,
	type MediaManagementDriftDiff,
	type MediaSettingsDriftExpected,
	type NamingDriftExpected
} from '$drift/mediaManagement.ts';
import { hashDriftDiff } from '$drift/hash.ts';
import type {
	ArrMediaManagementConfig,
	RadarrNamingConfig,
	SonarrNamingConfig
} from '$arr/types.ts';
import { transformMediaSettings } from '$sync/mediaManagement/transformer.ts';

function expectedMediaSettings(
	input: Partial<MediaSettingsDriftExpected> = {}
): MediaSettingsDriftExpected {
	return {
		name: input.name ?? 'Standard Media Settings',
		downloadPropersAndRepacks: input.downloadPropersAndRepacks ?? 'preferAndUpgrade',
		enableMediaInfo: input.enableMediaInfo ?? true
	};
}

function actualMediaSettings(
	input: Partial<ArrMediaManagementConfig> = {}
): ArrMediaManagementConfig {
	return {
		id: input.id ?? 1,
		downloadPropersAndRepacks: input.downloadPropersAndRepacks ?? 'preferAndUpgrade',
		enableMediaInfo: input.enableMediaInfo ?? true,
		...input
	};
}

function expectedRadarrNaming(input: Partial<NamingDriftExpected> = {}): NamingDriftExpected {
	return {
		name: input.name ?? 'Standard Naming',
		arrType: 'radarr',
		fields: {
			renameMovies: true,
			replaceIllegalCharacters: true,
			colonReplacementFormat: 'smart',
			standardMovieFormat: '{Movie CleanTitle} ({Release Year})',
			movieFolderFormat: '{Movie CleanTitle} ({Release Year})',
			...input.fields
		}
	};
}

function actualRadarrNaming(input: Partial<RadarrNamingConfig> = {}): RadarrNamingConfig {
	return {
		id: input.id ?? 1,
		renameMovies: input.renameMovies ?? true,
		replaceIllegalCharacters: input.replaceIllegalCharacters ?? true,
		colonReplacementFormat: input.colonReplacementFormat ?? 'smart',
		standardMovieFormat: input.standardMovieFormat ?? '{Movie CleanTitle} ({Release Year})',
		movieFolderFormat: input.movieFolderFormat ?? '{Movie CleanTitle} ({Release Year})',
		...input
	};
}

function expectedSonarrNaming(input: Partial<NamingDriftExpected> = {}): NamingDriftExpected {
	return {
		name: input.name ?? 'Standard Naming',
		arrType: 'sonarr',
		fields: {
			renameEpisodes: true,
			replaceIllegalCharacters: true,
			colonReplacementFormat: 'spaceDash',
			customColonReplacementFormat: null,
			multiEpisodeStyle: 'scene',
			standardEpisodeFormat: '{Series Title} - S{season:00}E{episode:00}',
			dailyEpisodeFormat: '{Series Title} - {Air-Date}',
			animeEpisodeFormat: '{Series Title} - S{season:00}E{episode:00}',
			seriesFolderFormat: '{Series Title}',
			seasonFolderFormat: 'Season {season:00}',
			...input.fields
		}
	};
}

function actualSonarrNaming(input: Partial<SonarrNamingConfig> = {}): SonarrNamingConfig {
	return {
		id: input.id ?? 1,
		renameEpisodes: input.renameEpisodes ?? true,
		replaceIllegalCharacters: input.replaceIllegalCharacters ?? true,
		colonReplacementFormat: input.colonReplacementFormat ?? 2,
		customColonReplacementFormat: input.customColonReplacementFormat ?? null,
		multiEpisodeStyle: input.multiEpisodeStyle ?? 3,
		standardEpisodeFormat:
			input.standardEpisodeFormat ?? '{Series Title} - S{season:00}E{episode:00}',
		dailyEpisodeFormat: input.dailyEpisodeFormat ?? '{Series Title} - {Air-Date}',
		animeEpisodeFormat: input.animeEpisodeFormat ?? '{Series Title} - S{season:00}E{episode:00}',
		seriesFolderFormat: input.seriesFolderFormat ?? '{Series Title}',
		seasonFolderFormat: input.seasonFolderFormat ?? 'Season {season:00}',
		specialsFolderFormat: input.specialsFolderFormat ?? 'Specials',
		...input
	};
}

class MediaManagementDriftTest extends BaseTest {
	runTests(): void {
		this.test('clean when no media settings are configured', () => {
			const result = compareMediaManagementDrift(null, actualMediaSettings());

			assertEquals(result.count, 0);
			assertEquals(result.diff, {
				media_settings: { missing: [], modified: [] },
				naming: { missing: [], modified: [] }
			});
		});

		this.test('clean when expected and actual media settings match', () => {
			const result = compareMediaManagementDrift(
				expectedMediaSettings(),
				actualMediaSettings({ untouchedArrField: 'preserved' })
			);

			assertEquals(result.count, 0);
			assertEquals(result.diff, {
				media_settings: { missing: [], modified: [] },
				naming: { missing: [], modified: [] }
			});
		});

		this.test('normalizes doNotUpgradeAutomatically to Arr doNotUpgrade', () => {
			const result = transformMediaSettings({
				propers_repacks: 'doNotUpgradeAutomatically',
				enable_media_info: true
			});

			assertEquals(result.downloadPropersAndRepacks, 'doNotUpgrade');
		});

		this.test('reports propers and repacks mismatch', () => {
			const result = compareMediaManagementDrift(
				expectedMediaSettings({ downloadPropersAndRepacks: 'doNotUpgrade' }),
				actualMediaSettings({ downloadPropersAndRepacks: 'doNotPrefer' })
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.media_settings.modified, [
				{
					name: 'Standard Media Settings',
					fields: [
						{
							path: 'downloadPropersAndRepacks',
							expected: 'doNotUpgrade',
							actual: 'doNotPrefer'
						}
					]
				}
			]);
		});

		this.test('reports enable media info mismatch', () => {
			const result = compareMediaManagementDrift(
				expectedMediaSettings({ enableMediaInfo: false }),
				actualMediaSettings({ enableMediaInfo: true })
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.media_settings.modified, [
				{
					name: 'Standard Media Settings',
					fields: [{ path: 'enableMediaInfo', expected: false, actual: true }]
				}
			]);
		});

		this.test('clean when expected and actual Radarr naming match', () => {
			const result = compareMediaManagementDrift(
				null,
				null,
				expectedRadarrNaming(),
				actualRadarrNaming({ untouchedArrField: 'preserved' })
			);

			assertEquals(result.count, 0);
			assertEquals(result.diff.naming, { missing: [], modified: [] });
		});

		this.test('reports Radarr naming managed field mismatch', () => {
			const result = compareMediaManagementDrift(
				null,
				null,
				expectedRadarrNaming(),
				actualRadarrNaming({ movieFolderFormat: '{Movie CleanTitle}' })
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.naming.modified, [
				{
					name: 'Standard Naming',
					fields: [
						{
							path: 'movieFolderFormat',
							expected: '{Movie CleanTitle} ({Release Year})',
							actual: '{Movie CleanTitle}'
						}
					]
				}
			]);
		});

		this.test('clean when Sonarr naming API enum values normalize to semantic values', () => {
			const result = compareMediaManagementDrift(
				null,
				null,
				expectedSonarrNaming(),
				actualSonarrNaming({ untouchedArrField: 'preserved' })
			);

			assertEquals(result.count, 0);
			assertEquals(result.diff.naming, { missing: [], modified: [] });
		});

		this.test('treats blank Sonarr custom colon replacement as empty', () => {
			const result = compareMediaManagementDrift(
				null,
				null,
				expectedSonarrNaming(),
				actualSonarrNaming({ customColonReplacementFormat: '' })
			);

			assertEquals(result.count, 0);
			assertEquals(result.diff.naming, { missing: [], modified: [] });
		});

		this.test('reports Sonarr colon replacement mismatch with semantic values', () => {
			const result = compareMediaManagementDrift(
				null,
				null,
				expectedSonarrNaming(),
				actualSonarrNaming({ colonReplacementFormat: 4 })
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.naming.modified, [
				{
					name: 'Standard Naming',
					fields: [
						{
							path: 'colonReplacementFormat',
							expected: 'spaceDash',
							actual: 'smart'
						}
					]
				}
			]);
		});

		this.test('reports Sonarr multi episode style mismatch with semantic values', () => {
			const result = compareMediaManagementDrift(
				null,
				null,
				expectedSonarrNaming(),
				actualSonarrNaming({ multiEpisodeStyle: 5 })
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.naming.modified, [
				{
					name: 'Standard Naming',
					fields: [
						{
							path: 'multiEpisodeStyle',
							expected: 'scene',
							actual: 'prefixedRange'
						}
					]
				}
			]);
		});

		this.test('hash is stable for equivalent object key order', async () => {
			const first: MediaManagementDriftDiff = {
				media_settings: {
					missing: [],
					modified: [
						{
							name: 'Standard Media Settings',
							fields: [{ path: 'enableMediaInfo', expected: false, actual: true }]
						}
					]
				},
				naming: {
					missing: [],
					modified: [
						{
							name: 'Standard Naming',
							fields: [
								{
									path: 'movieFolderFormat',
									expected: '{Movie}',
									actual: '{Movie CleanTitle}'
								}
							]
						}
					]
				}
			};
			const second = {
				media_settings: {
					modified: [
						{
							fields: [{ actual: true, expected: false, path: 'enableMediaInfo' }],
							name: 'Standard Media Settings'
						}
					],
					missing: []
				},
				naming: {
					modified: [
						{
							fields: [
								{
									actual: '{Movie CleanTitle}',
									expected: '{Movie}',
									path: 'movieFolderFormat'
								}
							],
							name: 'Standard Naming'
						}
					],
					missing: []
				}
			};

			assertEquals(
				await hashDriftDiff({ media_management: first }),
				await hashDriftDiff({ media_management: second })
			);
		});
	}
}

const mediaManagementDriftTest = new MediaManagementDriftTest();
mediaManagementDriftTest.runTests();
