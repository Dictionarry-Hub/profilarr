/**
 * Tests for normalization logic
 * Tests normalizeRadarrItem() and normalizeRadarrItems() from upgrades/normalize.ts
 */

import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { expect } from 'vitest';
import {
	normalizeRadarrItem,
	normalizeRadarrItems,
	normalizeSonarrItem
} from '#server/upgrades/normalize.ts';
import type {
	RadarrMovie,
	RadarrMovieFile,
	ArrQualityProfile,
	SonarrEpisodeFile,
	SonarrSeries
} from '#arr/types.ts';

class NormalizeTest extends BaseTest {
	/**
	 * Create a mock movie based on real Radarr API response
	 */
	private createMockMovie(overrides: Partial<RadarrMovie> = {}): RadarrMovie {
		return {
			id: 1,
			title: 'Beetlejuice Beetlejuice',
			originalTitle: 'Beetlejuice Beetlejuice',
			originalLanguage: { id: 1, name: 'English' },
			year: 2024,
			qualityProfileId: 7,
			hasFile: true,
			movieFileId: 16,
			monitored: false,
			minimumAvailability: 'announced',
			runtime: 105,
			tmdbId: 917496,
			imdbId: 'tt2049403',
			added: '2024-12-28T00:48:06Z',
			ratings: {
				imdb: { votes: 166926, value: 6.6 },
				tmdb: { votes: 2863, value: 6.961 },
				rottenTomatoes: { votes: 0, value: 75 },
				trakt: { votes: 12513, value: 6.80532 }
			},
			genres: ['Comedy', 'Fantasy', 'Horror'],
			studio: 'Warner Bros. Pictures',
			path: '/data/media/movies/Beetlejuice Beetlejuice (2024)',
			sizeOnDisk: 13880140407,
			status: 'released',
			tags: [1, 2, 3],
			collection: { title: 'Beetlejuice Collection', tmdbId: 945475 },
			popularity: 6.5513,
			...overrides
		};
	}

	/**
	 * Create a mock movie file based on real Radarr API response
	 */
	private createMockMovieFile(overrides: Partial<RadarrMovieFile> = {}): RadarrMovieFile {
		return {
			id: 16,
			movieId: 1,
			relativePath:
				'Beetlejuice Beetlejuice (2024) {tmdb-917496} [Bluray-1080p][EAC3 7.1][x264]-ZoroSenpai.mkv',
			path: '/data/media/movies/Beetlejuice Beetlejuice (2024)/Beetlejuice Beetlejuice (2024) {tmdb-917496} [Bluray-1080p][EAC3 7.1][x264]-ZoroSenpai.mkv',
			size: 13880140407,
			dateAdded: '2024-12-28T23:25:51Z',
			sceneName: 'Beetlejuice.Beetlejuice.2024.Hybrid.1080p.BluRay.DDP7.1.x264-ZoroSenpai',
			releaseGroup: 'ZoroSenpai',
			edition: '',
			languages: [{ id: 1, name: 'English' }],
			quality: {
				quality: {
					id: 7,
					name: 'Bluray-1080p',
					source: 'bluray',
					resolution: 1080
				},
				revision: { version: 1, real: 0, isRepack: false }
			},
			customFormats: [
				{ id: 1474, name: '1080p' },
				{ id: 1424, name: '1080p Bluray' },
				{ id: 1444, name: '1080p Quality Tier 1' },
				{ id: 1434, name: 'Dolby Digital +' }
			],
			customFormatScore: 225600,
			mediaInfo: {
				audioBitrate: 1536000,
				audioChannels: 7.1,
				audioCodec: 'EAC3',
				audioLanguages: 'eng/eng',
				audioStreamCount: 2,
				videoBitDepth: 8,
				videoBitrate: 16025380,
				videoCodec: 'x264',
				videoFps: 23.976,
				resolution: '1920x1038',
				runTime: '1:44:41',
				scanType: 'Progressive'
			},
			originalFilePath:
				'Beetlejuice.Beetlejuice.2024.Hybrid.1080p.BluRay.DDP7.1.x264-ZoroSenpai.mkv',
			...overrides
		};
	}

	/**
	 * Create a mock quality profile based on real Radarr API response
	 */
	private createMockProfile(overrides: Partial<ArrQualityProfile> = {}): ArrQualityProfile {
		return {
			id: 7,
			name: '1080p Quality',
			upgradeAllowed: true,
			cutoff: 1001,
			cutoffFormatScore: 400000,
			minFormatScore: 20000,
			formatItems: [
				{ format: 1463, name: 'Not Original', score: -999999 },
				{ format: 1440, name: '1080p WEB-DL', score: 200000 },
				{ format: 1424, name: '1080p Bluray', score: 140000 }
			],
			...overrides
		};
	}

	private createMockEpisodeFile(overrides: Partial<SonarrEpisodeFile> = {}): SonarrEpisodeFile {
		return {
			id: 1,
			seriesId: 1,
			seasonNumber: 1,
			size: 1_000_000,
			quality: { quality: { id: 1, name: 'WEBDL-1080p' } },
			customFormats: [],
			customFormatScore: 0,
			qualityCutoffNotMet: true,
			...overrides
		};
	}

	runTests(): void {
		// =====================
		// Basic Field Mapping
		// =====================

		this.test('normalizes basic movie fields correctly', () => {
			const movie = this.createMockMovie();
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.id).toStrictEqual(1);
			expect(result.title).toStrictEqual('Beetlejuice Beetlejuice');
			expect(result.year).toStrictEqual(2024);
			expect(result.monitored).toStrictEqual(false);
			expect(result.minimum_availability).toStrictEqual('announced');
			expect(result.runtime).toStrictEqual(105);
		});

		this.test('normalizes quality profile name', () => {
			const movie = this.createMockMovie();
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile({ name: 'Custom 4K Profile' });

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.quality_profile).toStrictEqual('Custom 4K Profile');
		});

		this.test('normalizes collection title', () => {
			const movie = this.createMockMovie({
				collection: { title: 'Marvel Cinematic Universe', tmdbId: 12345 }
			});
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.collection).toStrictEqual('Marvel Cinematic Universe');
		});

		this.test('normalizes studio', () => {
			const movie = this.createMockMovie({ studio: 'Warner Bros. Pictures' });
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.studio).toStrictEqual('Warner Bros. Pictures');
		});

		this.test('normalizes original language', () => {
			const movie = this.createMockMovie({
				originalLanguage: { id: 2, name: 'Japanese' }
			});
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.original_language).toStrictEqual('Japanese');
		});

		this.test('normalizes genres as string array', () => {
			const movie = this.createMockMovie({
				genres: ['Comedy', 'Fantasy', 'Horror']
			});
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.genres).toStrictEqual(['Comedy', 'Fantasy', 'Horror']);
		});

		this.test('normalizes release group from movie file', () => {
			const movie = this.createMockMovie();
			const movieFile = this.createMockMovieFile({ releaseGroup: 'ZoroSenpai' });
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.release_group).toStrictEqual('ZoroSenpai');
		});

		this.test('normalizes custom formats from movie file', () => {
			const movie = this.createMockMovie();
			const movieFile = this.createMockMovieFile({
				customFormats: [
					{ id: 1, name: 'Tier 6' },
					{ id: 2, name: 'HDR10' }
				]
			});
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.custom_formats).toStrictEqual(['Tier 6', 'HDR10']);
		});

		this.test('normalizes popularity', () => {
			const movie = this.createMockMovie({ popularity: 6.5513 });
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(Math.abs(result.popularity - 6.5513)).toBeLessThanOrEqual(0.0001);
		});

		// =====================
		// Size Conversion
		// =====================

		this.test('converts size to GB correctly', () => {
			const movie = this.createMockMovie({ sizeOnDisk: 13880140407 }); // ~12.93 GB
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			// 13880140407 / (1024^3) = 12.927...
			expect(Math.abs(result.size_on_disk - 12.927)).toBeLessThanOrEqual(0.01);
		});

		this.test('handles zero size', () => {
			const movie = this.createMockMovie({ sizeOnDisk: 0 });
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.size_on_disk).toStrictEqual(0);
		});

		// =====================
		// Ratings
		// =====================

		this.test('normalizes all ratings correctly', () => {
			const movie = this.createMockMovie({
				ratings: {
					imdb: { votes: 166926, value: 6.6 },
					tmdb: { votes: 2863, value: 6.961 },
					rottenTomatoes: { votes: 0, value: 75 },
					trakt: { votes: 12513, value: 6.80532 }
				}
			});
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(Math.abs(result.imdb_rating - 6.6)).toBeLessThanOrEqual(0.001);
			expect(Math.abs(result.tmdb_rating - 6.961)).toBeLessThanOrEqual(0.001);
			expect(result.tomato_rating).toStrictEqual(75);
			expect(Math.abs(result.trakt_rating - 6.80532)).toBeLessThanOrEqual(0.00001);
		});

		this.test('handles missing ratings', () => {
			const movie = this.createMockMovie({ ratings: undefined });
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.imdb_rating).toStrictEqual(0);
			expect(result.tmdb_rating).toStrictEqual(0);
			expect(result.tomato_rating).toStrictEqual(0);
			expect(result.trakt_rating).toStrictEqual(0);
		});

		this.test('handles partial ratings', () => {
			const movie = this.createMockMovie({
				ratings: {
					imdb: { votes: 100, value: 7.5 }
					// tmdb, rottenTomatoes, trakt are undefined
				}
			});
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(Math.abs(result.imdb_rating - 7.5)).toBeLessThanOrEqual(0.001);
			expect(result.tmdb_rating).toStrictEqual(0);
			expect(result.tomato_rating).toStrictEqual(0);
			expect(result.trakt_rating).toStrictEqual(0);
		});

		// =====================
		// Cutoff Calculation
		// =====================

		this.test('calculates cutoff_met correctly when score meets threshold', () => {
			const movie = this.createMockMovie();
			const movieFile = this.createMockMovieFile({ customFormatScore: 320000 });
			const profile = this.createMockProfile({ cutoffFormatScore: 400000 });

			// 80% of 400000 = 320000, score is 320000 so cutoff is met
			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.cutoff_met).toStrictEqual(true);
			expect(result.score).toStrictEqual(320000);
		});

		this.test('calculates cutoff_met correctly when score below threshold', () => {
			const movie = this.createMockMovie();
			const movieFile = this.createMockMovieFile({ customFormatScore: 200000 });
			const profile = this.createMockProfile({ cutoffFormatScore: 400000 });

			// 80% of 400000 = 320000, score is 200000 so cutoff is NOT met
			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.cutoff_met).toStrictEqual(false);
		});

		this.test('calculates cutoff with different percentages', () => {
			const movie = this.createMockMovie();
			const movieFile = this.createMockMovieFile({ customFormatScore: 200000 });
			const profile = this.createMockProfile({ cutoffFormatScore: 400000 });

			// 50% of 400000 = 200000, score is 200000 so cutoff is met
			const result = normalizeRadarrItem(movie, movieFile, profile, 50);

			expect(result.cutoff_met).toStrictEqual(true);
		});

		this.test('handles zero cutoff score in profile', () => {
			const movie = this.createMockMovie();
			const movieFile = this.createMockMovieFile({ customFormatScore: 100 });
			const profile = this.createMockProfile({ cutoffFormatScore: 0 });

			// 80% of 0 = 0, any score >= 0 meets cutoff
			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.cutoff_met).toStrictEqual(true);
		});

		// =====================
		// Date Handling
		// =====================

		this.test('normalizes date_added from movie', () => {
			const movie = this.createMockMovie({ added: '2024-12-28T00:48:06Z' });
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.date_added).toStrictEqual('2024-12-28T00:48:06Z');
			expect(result.dateAdded).toStrictEqual('2024-12-28T00:48:06Z');
		});

		this.test('uses current date when added is missing', () => {
			const movie = this.createMockMovie({ added: undefined });
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const before = new Date().toISOString();
			const result = normalizeRadarrItem(movie, movieFile, profile, 80);
			const after = new Date().toISOString();

			// date_added should be between before and after
			expect(result.date_added >= before).toStrictEqual(true);
			expect(result.date_added <= after).toStrictEqual(true);
		});

		// =====================
		// Tags and Raw Data
		// =====================

		this.test('preserves tags from movie', () => {
			const movie = this.createMockMovie({ tags: [1, 2, 3] });
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();
			const tagMap = new Map([
				[1, 'no-redownload'],
				[2, 'profilarr-upgrades'],
				[3, 'manual-review']
			]);

			const result = normalizeRadarrItem(movie, movieFile, profile, 80, tagMap);

			expect(result.tags).toStrictEqual(['no-redownload', 'profilarr-upgrades', 'manual-review']);
			expect(result._tags).toStrictEqual([1, 2, 3]);
		});

		this.test('handles empty tags', () => {
			const movie = this.createMockMovie({ tags: [] });
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result._tags).toStrictEqual([]);
		});

		this.test('handles undefined tags', () => {
			const movie = this.createMockMovie({ tags: undefined });
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result._tags).toStrictEqual([]);
		});

		this.test('preserves raw movie data', () => {
			const movie = this.createMockMovie();
			const movieFile = this.createMockMovieFile();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result._raw).toStrictEqual(movie);
			expect(result._raw.id).toStrictEqual(1);
			expect(result._raw.title).toStrictEqual('Beetlejuice Beetlejuice');
		});

		// =====================
		// Missing Data Handling
		// =====================

		this.test('handles undefined movie file', () => {
			const movie = this.createMockMovie();
			const profile = this.createMockProfile();

			const result = normalizeRadarrItem(movie, undefined, profile, 80);

			expect(result.score).toStrictEqual(0);
			expect(result.release_group).toStrictEqual('');
			expect(result.cutoff_met).toStrictEqual(false); // 0 < 320000 (80% of 400000)
			expect(result.custom_formats).toStrictEqual([]);
		});

		this.test('handles undefined profile', () => {
			const movie = this.createMockMovie();
			const movieFile = this.createMockMovieFile();

			const result = normalizeRadarrItem(movie, movieFile, undefined, 80);

			expect(result.quality_profile).toStrictEqual('Unknown');
			expect(result.cutoff_met).toStrictEqual(true); // 0 threshold, any score meets it
		});

		this.test('handles all undefined optional fields', () => {
			const movie: RadarrMovie = {
				id: 1,
				title: 'Minimal Movie',
				qualityProfileId: 1,
				hasFile: false
			};

			const result = normalizeRadarrItem(movie, undefined, undefined, 80);

			expect(result.id).toStrictEqual(1);
			expect(result.title).toStrictEqual('Minimal Movie');
			expect(result.year).toStrictEqual(0);
			expect(result.monitored).toStrictEqual(false);
			expect(result.minimum_availability).toStrictEqual('released');
			expect(result.quality_profile).toStrictEqual('Unknown');
			expect(result.collection).toStrictEqual('');
			expect(result.studio).toStrictEqual('');
			expect(result.original_language).toStrictEqual('');
			expect(result.genres).toStrictEqual([]);
			expect(result.release_group).toStrictEqual('');
			expect(result.popularity).toStrictEqual(0);
			expect(result.runtime).toStrictEqual(0);
			expect(result.size_on_disk).toStrictEqual(0);
			expect(result.imdb_rating).toStrictEqual(0);
			expect(result.tmdb_rating).toStrictEqual(0);
			expect(result.tomato_rating).toStrictEqual(0);
			expect(result.trakt_rating).toStrictEqual(0);
			expect(result.score).toStrictEqual(0);
			expect(result._tags).toStrictEqual([]);
			expect(result.custom_formats).toStrictEqual([]);
		});

		this.test('normalizes sonarr custom formats as empty', () => {
			const series: SonarrSeries = {
				id: 1,
				title: 'Example Series',
				qualityProfileId: 7,
				monitored: true,
				seasons: []
			};
			const profile = this.createMockProfile();

			const result = normalizeSonarrItem(series, profile, 80);

			expect(result.custom_formats).toStrictEqual([]);
		});

		this.test('normalizes sonarr score as the episode-file average', () => {
			const series: SonarrSeries = {
				id: 1,
				title: 'Example Series',
				qualityProfileId: 7,
				monitored: true,
				seasons: []
			};
			const profile = this.createMockProfile({ cutoffFormatScore: 201 });
			const files = [
				this.createMockEpisodeFile({ id: 1, customFormatScore: 100 }),
				this.createMockEpisodeFile({ id: 2, customFormatScore: 101 })
			];

			const result = normalizeSonarrItem(series, profile, 50, files);

			expect(result.score).toStrictEqual(100.5);
			expect(result.cutoff_met).toStrictEqual(true);
		});

		this.test('normalizes sonarr cutoff as not met when the average is below threshold', () => {
			const series: SonarrSeries = {
				id: 1,
				title: 'Example Series',
				qualityProfileId: 7,
				monitored: true,
				seasons: []
			};
			const profile = this.createMockProfile({ cutoffFormatScore: 400 });
			const files = [
				this.createMockEpisodeFile({ id: 1, customFormatScore: -100 }),
				this.createMockEpisodeFile({ id: 2, customFormatScore: 200 })
			];

			const result = normalizeSonarrItem(series, profile, 80, files);

			expect(result.score).toStrictEqual(50);
			expect(result.cutoff_met).toStrictEqual(false);
		});

		this.test('normalizes sonarr series without files as zero and cutoff not met', () => {
			const series: SonarrSeries = {
				id: 1,
				title: 'Example Series',
				qualityProfileId: 7,
				monitored: true,
				seasons: []
			};
			const profile = this.createMockProfile({ cutoffFormatScore: 0 });

			const result = normalizeSonarrItem(series, profile, 100, []);

			expect(result.score).toStrictEqual(0);
			expect(result.cutoff_met).toStrictEqual(false);
		});

		// =====================
		// Batch Normalization
		// =====================

		this.test('normalizes batch of movies correctly', () => {
			const movies = [
				this.createMockMovie({ id: 1, title: 'Movie 1', qualityProfileId: 7 }),
				this.createMockMovie({ id: 2, title: 'Movie 2', qualityProfileId: 7 }),
				this.createMockMovie({ id: 3, title: 'Movie 3', qualityProfileId: 8 })
			];

			const movieFileMap = new Map([
				[1, this.createMockMovieFile({ movieId: 1, customFormatScore: 100000 })],
				[2, this.createMockMovieFile({ movieId: 2, customFormatScore: 200000 })]
				// Movie 3 has no file
			]);

			const profileMap = new Map([
				[7, this.createMockProfile({ id: 7, name: '1080p Quality' })],
				[8, this.createMockProfile({ id: 8, name: '4K Quality', cutoffFormatScore: 500000 })]
			]);

			const results = normalizeRadarrItems(movies, movieFileMap, profileMap, 80);

			expect(results.length).toStrictEqual(3);

			expect(results[0].id).toStrictEqual(1);
			expect(results[0].title).toStrictEqual('Movie 1');
			expect(results[0].quality_profile).toStrictEqual('1080p Quality');
			expect(results[0].score).toStrictEqual(100000);

			expect(results[1].id).toStrictEqual(2);
			expect(results[1].title).toStrictEqual('Movie 2');
			expect(results[1].score).toStrictEqual(200000);

			expect(results[2].id).toStrictEqual(3);
			expect(results[2].title).toStrictEqual('Movie 3');
			expect(results[2].quality_profile).toStrictEqual('4K Quality');
			expect(results[2].score).toStrictEqual(0); // No movie file
		});

		this.test('batch normalization handles empty input', () => {
			const movieFileMap = new Map<number, RadarrMovieFile>();
			const profileMap = new Map<number, ArrQualityProfile>();

			const results = normalizeRadarrItems([], movieFileMap, profileMap, 80);

			expect(results.length).toStrictEqual(0);
		});

		// =====================
		// Real-world Scenarios
		// =====================

		this.test('scenario: movie with file meeting cutoff', () => {
			const movie = this.createMockMovie({
				id: 1,
				title: 'Beetlejuice Beetlejuice',
				monitored: true,
				year: 2024
			});
			const movieFile = this.createMockMovieFile({
				customFormatScore: 225600,
				releaseGroup: 'ZoroSenpai'
			});
			const profile = this.createMockProfile({
				cutoffFormatScore: 400000
			});

			// Cutoff at 80%: 400000 * 0.8 = 320000
			// Score 225600 < 320000, so cutoff NOT met
			const result = normalizeRadarrItem(movie, movieFile, profile, 80);

			expect(result.cutoff_met).toStrictEqual(false);
			expect(result.score).toStrictEqual(225600);

			// But at 50% cutoff: 400000 * 0.5 = 200000
			// Score 225600 >= 200000, so cutoff IS met
			const result50 = normalizeRadarrItem(movie, movieFile, profile, 50);
			expect(result50.cutoff_met).toStrictEqual(true);
		});

		this.test('scenario: filter upgrade candidates', () => {
			const movies = [
				this.createMockMovie({ id: 1, title: 'Good Quality', monitored: true }),
				this.createMockMovie({ id: 2, title: 'Needs Upgrade', monitored: true }),
				this.createMockMovie({ id: 3, title: 'Unmonitored', monitored: false }),
				this.createMockMovie({ id: 4, title: 'No File', monitored: true, hasFile: false })
			];

			const movieFileMap = new Map([
				[1, this.createMockMovieFile({ movieId: 1, customFormatScore: 350000 })], // Above 80%
				[2, this.createMockMovieFile({ movieId: 2, customFormatScore: 150000 })] // Below 80%
			]);

			const profileMap = new Map([[7, this.createMockProfile({ cutoffFormatScore: 400000 })]]);

			const results = normalizeRadarrItems(movies, movieFileMap, profileMap, 80);

			// Filter for monitored, cutoff not met
			const upgradeCandidates = results.filter((r) => r.monitored && !r.cutoff_met);

			expect(upgradeCandidates.length).toStrictEqual(2);
			expect(upgradeCandidates[0].title).toStrictEqual('Needs Upgrade');
			expect(upgradeCandidates[1].title).toStrictEqual('No File');
		});
	}
}

// Create instance and run tests
const normalizeTest = new NormalizeTest();
normalizeTest.runTests();
