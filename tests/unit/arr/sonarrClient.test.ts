import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import { SonarrClient } from '$utils/arr/clients/sonarr.ts';
import type { ArrQualityProfile, SonarrSeries } from '$utils/arr/types.ts';

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

			try {
				const library = await client.getLibrary(new Set(['HD']));

				assertEquals(library[0].qualityProfileName, 'HD');
				assertEquals(library[0].isProfilarrProfile, true);
				assertEquals(library[0].seasons[0], {
					seasonNumber: 1,
					monitored: true,
					episodeCount: 0,
					episodeFileCount: 0,
					totalEpisodeCount: 0,
					sizeOnDisk: 0,
					percentOfEpisodes: 0
				});
				assertEquals(library[0].seasons[1].episodeCount, 8);
			} finally {
				client.close();
			}
		});
	}
}

const sonarrClientTest = new SonarrClientTest();
sonarrClientTest.runTests();
