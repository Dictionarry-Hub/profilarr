import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { SonarrClient } from '#arr/clients/sonarr.ts';
import type { ArrQualityProfile, SonarrSeries } from '#arr/types.ts';

class MockSonarrClient extends SonarrClient {
	constructor(
		private readonly series: SonarrSeries[],
		private readonly profiles: ArrQualityProfile[]
	) {
		super('http://sonarr.local', 'test-api-key');
	}

	override getAllSeries(): Promise<SonarrSeries[]> {
		return Promise.resolve(this.series);
	}

	override getQualityProfiles(): Promise<ArrQualityProfile[]> {
		return Promise.resolve(this.profiles);
	}
}

class SonarrClientTest extends BaseTest {
	runTests(): void {
		this.test('maps seasons with missing statistics to zero values', async () => {
			const client = new MockSonarrClient(
				[
					{
						id: 1,
						title: 'Whatbox Show',
						qualityProfileId: 10,
						monitored: true,
						seasons: [
							{
								seasonNumber: 1,
								monitored: true
							},
							{
								seasonNumber: 2,
								monitored: true,
								statistics: {
									episodeCount: 8,
									episodeFileCount: 7,
									totalEpisodeCount: 8,
									sizeOnDisk: 1234,
									releaseGroups: [],
									percentOfEpisodes: 87.5
								}
							}
						]
					}
				],
				[
					{
						id: 10,
						name: 'HD',
						upgradeAllowed: true,
						cutoff: 1,
						items: [],
						minFormatScore: 0,
						cutoffFormatScore: 0,
						formatItems: []
					}
				]
			);

			const library = await client.getLibrary(new Set(['HD']));

			expect(library[0].qualityProfileName).toStrictEqual('HD');
			expect(library[0].isProfilarrProfile).toStrictEqual(true);
			expect(library[0].seasons[0]).toStrictEqual({
				seasonNumber: 1,
				monitored: true,
				episodeCount: 0,
				episodeFileCount: 0,
				totalEpisodeCount: 0,
				sizeOnDisk: 0,
				percentOfEpisodes: 0
			});
			expect(library[0].seasons[1].episodeCount).toStrictEqual(8);
		});
	}
}

const sonarrClientTest = new SonarrClientTest();
sonarrClientTest.runTests();
