import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import type { SonarrClient } from '#arr/clients/sonarr.ts';
import type { SonarrEpisodeFile, SonarrSeries } from '#arr/types.ts';
import type { FilterConfig } from '#shared/upgrades/filters.ts';
import {
	averageEpisodeFileScore,
	filterNeedsSonarrScores,
	loadSonarrEpisodeFiles
} from '#server/upgrades/sonarrScores.ts';

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

			expect(averageEpisodeFileScore(files)).toStrictEqual(250 / 3);
			expect(averageEpisodeFileScore(files, 1)).toStrictEqual(150);
			expect(averageEpisodeFileScore(files, 3)).toStrictEqual(0);
		});

		this.test('detects cutoff rules and the lowest-score selector', () => {
			expect(filterNeedsSonarrScores(this.createFilter('random', 'cutoff_met'))).toStrictEqual(
				true
			);
			expect(filterNeedsSonarrScores(this.createFilter('lowest_score'))).toStrictEqual(true);
			expect(filterNeedsSonarrScores(this.createFilter('random'))).toStrictEqual(false);
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

			expect(calls).toStrictEqual([1]);
			expect(result.get(1)?.length).toStrictEqual(1);
			expect(result.get(2)).toStrictEqual([]);
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

			expect(calls).toStrictEqual([]);
			expect(result.get(1)).toStrictEqual(existing.get(1));
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

			expect(calls).toStrictEqual([1]);
		});

		this.test('identifies the series when episode-file loading fails', async () => {
			const client = {
				getEpisodeFiles: () => Promise.reject(new Error('unavailable'))
			} as unknown as SonarrClient;

			await expect(loadSonarrEpisodeFiles(client, [this.createSeries(3, 1)])).rejects.toThrow(
				Error
			);
			await expect(loadSonarrEpisodeFiles(client, [this.createSeries(3, 1)])).rejects.toThrow(
				'Failed to fetch episode files for "Series 3": unavailable'
			);
		});
	}
}

new SonarrScoresTest().runTests();
