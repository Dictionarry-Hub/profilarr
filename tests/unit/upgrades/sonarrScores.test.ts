import { assertEquals, assertRejects } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import type { SonarrClient } from '$utils/arr/clients/sonarr.ts';
import type { SonarrEpisodeFile, SonarrSeries } from '$utils/arr/types.ts';
import type { FilterConfig } from '$shared/upgrades/filters.ts';
import {
	averageEpisodeFileScore,
	filterNeedsSonarrScores,
	loadSonarrEpisodeFiles
} from '$lib/server/upgrades/sonarrScores.ts';

class SonarrScoresTest extends BaseTest {
	private createSeries(id: number, episodeFileCount: number): SonarrSeries {
		return {
			id,
			title: `Series ${id}`,
			qualityProfileId: 1,
			monitored: true,
			seasons: [],
			statistics: {
				seasonCount: 1,
				episodeFileCount,
				episodeCount: episodeFileCount,
				totalEpisodeCount: episodeFileCount,
				sizeOnDisk: episodeFileCount * 1_000_000,
				percentOfEpisodes: episodeFileCount > 0 ? 100 : 0
			}
		};
	}

	private createEpisodeFile(
		id: number,
		seriesId: number,
		seasonNumber: number,
		customFormatScore: number
	): SonarrEpisodeFile {
		return {
			id,
			seriesId,
			seasonNumber,
			size: 1_000_000,
			quality: { quality: { id: 1, name: 'WEBDL-1080p' } },
			customFormats: [],
			customFormatScore,
			qualityCutoffNotMet: false
		};
	}

	private createFilter(selector: string, field = 'monitored'): FilterConfig {
		return {
			id: 'filter-1',
			name: 'Filter',
			enabled: true,
			selector,
			count: 1,
			cutoff: 100,
			group: {
				type: 'group',
				match: 'all',
				children: [{ type: 'rule', field, operator: 'is', value: true }]
			}
		};
	}

	runTests(): void {
		this.test('averages all episode files or only the requested season', () => {
			const files = [
				this.createEpisodeFile(1, 1, 1, 100),
				this.createEpisodeFile(2, 1, 1, 200),
				this.createEpisodeFile(3, 1, 2, -50)
			];

			assertEquals(averageEpisodeFileScore(files), 250 / 3);
			assertEquals(averageEpisodeFileScore(files, 1), 150);
			assertEquals(averageEpisodeFileScore(files, 3), 0);
		});

		this.test('detects cutoff rules and the lowest-score selector', () => {
			assertEquals(filterNeedsSonarrScores(this.createFilter('random', 'cutoff_met')), true);
			assertEquals(filterNeedsSonarrScores(this.createFilter('lowest_score')), true);
			assertEquals(filterNeedsSonarrScores(this.createFilter('random')), false);
		});

		this.test('loads file-bearing series and skips series without files', async () => {
			const calls: number[] = [];
			const client = {
				getEpisodeFiles: (seriesId: number) => {
					calls.push(seriesId);
					return Promise.resolve([this.createEpisodeFile(1, seriesId, 1, 100)]);
				}
			} as unknown as SonarrClient;

			const result = await loadSonarrEpisodeFiles(client, [
				this.createSeries(1, 1),
				this.createSeries(2, 0)
			]);

			assertEquals(calls, [1]);
			assertEquals(result.get(1)?.length, 1);
			assertEquals(result.get(2), []);
		});

		this.test('reuses existing episode files without another request', async () => {
			const calls: number[] = [];
			const client = {
				getEpisodeFiles: (seriesId: number) => {
					calls.push(seriesId);
					return Promise.resolve([]);
				}
			} as unknown as SonarrClient;
			const existing = new Map([[1, [this.createEpisodeFile(1, 1, 1, 100)]]]);

			const result = await loadSonarrEpisodeFiles(client, [this.createSeries(1, 1)], existing);

			assertEquals(calls, []);
			assertEquals(result.get(1), existing.get(1));
		});

		this.test('fetches when series statistics are unavailable', async () => {
			const calls: number[] = [];
			const client = {
				getEpisodeFiles: (seriesId: number) => {
					calls.push(seriesId);
					return Promise.resolve([]);
				}
			} as unknown as SonarrClient;
			const series = this.createSeries(1, 0);
			series.statistics = undefined;
			series.seasons = [{ seasonNumber: 1, monitored: true }];

			await loadSonarrEpisodeFiles(client, [series]);

			assertEquals(calls, [1]);
		});

		this.test('identifies the series when episode-file loading fails', async () => {
			const client = {
				getEpisodeFiles: () => Promise.reject(new Error('unavailable'))
			} as unknown as SonarrClient;

			await assertRejects(
				() => loadSonarrEpisodeFiles(client, [this.createSeries(3, 1)]),
				Error,
				'Failed to fetch episode files for "Series 3": unavailable'
			);
		});
	}
}

new SonarrScoresTest().runTests();
