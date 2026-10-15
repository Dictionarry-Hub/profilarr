import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import {
	compareQualityProfileDrift,
	type QualityProfileDriftDiff,
	type QualityProfileDriftExpected
} from '$drift/qualityProfiles.ts';
import { hashDriftDiff } from '$drift/hash.ts';
import { buildDriftDisplayEntities } from '$drift/display.ts';
import type {
	ArrCustomFormat,
	ArrLanguage,
	ArrQualityProfile,
	ArrQualityProfileItem,
	ArrQualityProfilePayload
} from '$arr/types.ts';

type ActualQualityProfile = ArrQualityProfile & {
	language?: ArrLanguage;
	minUpgradeFormatScore?: number;
};

const qualityItem = (name: string, id: number, allowed = true): ArrQualityProfileItem => ({
	quality: { id, name, source: 'web', resolution: 1080 },
	items: [],
	allowed
});

const groupItem = (
	name: string,
	id: number,
	members: ArrQualityProfileItem[],
	allowed = true
): ArrQualityProfileItem => ({
	id,
	name,
	items: members,
	allowed
});

function customFormat(name: string, id: number): ArrCustomFormat {
	return {
		id,
		name,
		includeCustomFormatWhenRenaming: false,
		specifications: []
	};
}

function expectedProfile(
	input: Partial<ArrQualityProfilePayload> & {
		name?: string;
		managedCustomFormatNames?: string[];
	}
): QualityProfileDriftExpected {
	const name = input.name ?? 'HD Movies';
	const profile: ArrQualityProfilePayload = {
		name,
		items: input.items ?? [qualityItem('WEBDL-1080p', 3), qualityItem('Bluray-1080p', 7)],
		language: input.language ?? { id: 1, name: 'English' },
		upgradeAllowed: input.upgradeAllowed ?? true,
		cutoff: input.cutoff ?? 7,
		minFormatScore: input.minFormatScore ?? 0,
		cutoffFormatScore: input.cutoffFormatScore ?? 1000,
		minUpgradeFormatScore: input.minUpgradeFormatScore ?? 1,
		formatItems: input.formatItems ?? [
			{ format: 100, name: 'Streaming Tier', score: 100 },
			{ format: 200, name: 'HDR10', score: 50 }
		]
	};

	return {
		profile,
		managedCustomFormatNames: input.managedCustomFormatNames ?? ['Streaming Tier', 'HDR10']
	};
}

function actualProfile(
	input: Partial<ActualQualityProfile> & { name?: string }
): ActualQualityProfile {
	return {
		id: input.id ?? 999,
		name: input.name ?? 'HD Movies',
		items: input.items ?? [qualityItem('WEBDL-1080p', 3), qualityItem('Bluray-1080p', 7)],
		language: input.language ?? { id: 1, name: 'English' },
		upgradeAllowed: input.upgradeAllowed ?? true,
		cutoff: input.cutoff ?? 7,
		minFormatScore: input.minFormatScore ?? 0,
		cutoffFormatScore: input.cutoffFormatScore ?? 1000,
		minUpgradeFormatScore: input.minUpgradeFormatScore ?? 1,
		formatItems: input.formatItems ?? [
			{ format: 1, name: 'Streaming Tier', score: 100 },
			{ format: 2, name: 'HDR10', score: 50 }
		]
	};
}

const formats = [customFormat('Streaming Tier', 1), customFormat('HDR10', 2)];

/** A quality row carrying the size limits Sonarr v5 keeps on profile items */
const sizedItem = (
	name: string,
	id: number,
	sizes: { minSize?: number | null; maxSize?: number | null; preferredSize?: number | null }
): ArrQualityProfileItem => ({ ...qualityItem(name, id), ...sizes });

class QualityProfileDriftTest extends BaseTest {
	runTests(): void {
		this.test(
			'item sizes: clean when expected and actual sizes match, group members included',
			() => {
				const expected = expectedProfile({
					items: [
						sizedItem('WEBDL-1080p', 3, { minSize: 15, maxSize: null, preferredSize: 995 }),
						groupItem('HD', 1001, [
							sizedItem('HDTV-1080p', 9, { minSize: 4, maxSize: 125, preferredSize: 95 })
						])
					],
					cutoff: 1001
				});
				const actual = actualProfile({
					items: [
						sizedItem('WEBDL-1080p', 3, { minSize: 15, preferredSize: 995 }),
						groupItem('HD', 1001, [
							sizedItem('HDTV-1080p', 9, { minSize: 4, maxSize: 125, preferredSize: 95 })
						])
					],
					cutoff: 1001
				});

				assertEquals(compareQualityProfileDrift([expected], [actual], formats, 'sonarr').count, 0);
			}
		);

		this.test('item sizes: a changed size reports one row per field, by quality name', () => {
			const expected = expectedProfile({
				items: [
					sizedItem('WEBDL-1080p', 3, { minSize: 15, maxSize: null, preferredSize: 995 }),
					groupItem('HD', 1001, [
						sizedItem('HDTV-1080p', 9, { minSize: 15, maxSize: null, preferredSize: 995 })
					])
				],
				cutoff: 1001
			});
			const actual = actualProfile({
				items: [
					sizedItem('WEBDL-1080p', 3, { minSize: 15, preferredSize: 995 }),
					groupItem('HD', 1001, [
						sizedItem('HDTV-1080p', 9, { minSize: 7, maxSize: 232, preferredSize: 531.2 })
					])
				],
				cutoff: 1001
			});

			const result = compareQualityProfileDrift([expected], [actual], formats, 'sonarr');

			assertEquals(result.count, 1);
			assertEquals(result.diff.modified[0].fields, [
				{ path: 'items[HDTV-1080p].maxSize', expected: null, actual: 232 },
				{ path: 'items[HDTV-1080p].minSize', expected: 15, actual: 7 },
				{ path: 'items[HDTV-1080p].preferredSize', expected: 995, actual: 531.2 }
			]);
		});

		this.test('item sizes: a key the Arr leaves out reads as null', () => {
			const expected = expectedProfile({
				items: [sizedItem('WEBDL-1080p', 3, { minSize: 15, maxSize: null, preferredSize: null })]
			});
			const actual = actualProfile({
				items: [qualityItem('WEBDL-1080p', 3)]
			});

			const result = compareQualityProfileDrift([expected], [actual], formats, 'sonarr');

			assertEquals(result.diff.modified[0].fields, [
				{ path: 'items[WEBDL-1080p].minSize', expected: 15, actual: null }
			]);
		});

		this.test('item sizes: an expected item without size keys is never compared', () => {
			const expected = expectedProfile({
				items: [qualityItem('WEBDL-1080p', 3), qualityItem('Bluray-1080p', 7)]
			});
			const actual = actualProfile({
				items: [
					sizedItem('WEBDL-1080p', 3, { minSize: 1, maxSize: 2, preferredSize: 1 }),
					sizedItem('Bluray-1080p', 7, { minSize: 1, maxSize: 2, preferredSize: 1 })
				]
			});

			assertEquals(compareQualityProfileDrift([expected], [actual], formats, 'sonarr').count, 0);
		});

		this.test('item sizes: the Arr maximum at its unlimited cap equals an expected null', () => {
			const expected = expectedProfile({
				items: [sizedItem('WEBDL-1080p', 3, { minSize: 15, maxSize: null, preferredSize: 995 })]
			});
			const actual = actualProfile({
				items: [sizedItem('WEBDL-1080p', 3, { minSize: 15, maxSize: 1000, preferredSize: 995 })]
			});

			assertEquals(compareQualityProfileDrift([expected], [actual], formats, 'sonarr').count, 0);
		});

		this.test(
			'item sizes: display rows are labelled by quality with the size field changed',
			() => {
				const entities = buildDriftDisplayEntities(
					{
						quality_profiles: [
							{
								databaseId: 1,
								databaseName: 'Dictionarry',
								diff: {
									missing: [],
									modified: [
										{
											name: '1080p Quality',
											fields: [
												{ path: 'items[HDTV-1080p].minSize', expected: 15, actual: null },
												{ path: 'items[HDTV-1080p].maxSize', expected: null, actual: 232 }
											]
										}
									]
								}
							}
						]
					},
					'sonarr'
				);

				assertEquals(entities.length, 1);
				assertEquals(entities[0].changes[0].label, 'HDTV-1080p');
				assertEquals(entities[0].changes[0].detail, 'Minimum Size changed');
				assertEquals(entities[0].changes[0].expected?.text, '15');
				assertEquals(entities[0].changes[0].actual?.text, 'None');
				assertEquals(entities[0].changes[1].detail, 'Maximum Size changed');
				assertEquals(entities[0].changes[1].expected?.text, 'Unlimited');
				assertEquals(entities[0].changes[1].actual?.text, '232');
			}
		);

		this.test('clean when expected and actual quality profiles match', () => {
			const result = compareQualityProfileDrift(
				[expectedProfile({})],
				[actualProfile({})],
				[customFormat('Streaming Tier', 1), customFormat('HDR10', 2)],
				'radarr'
			);

			assertEquals(result.count, 0);
			assertEquals(result.diff, { missing: [], modified: [] });
		});

		this.test('reports selected quality profile missing from Arr', () => {
			const result = compareQualityProfileDrift(
				[expectedProfile({ name: 'HD Movies' })],
				[],
				[customFormat('Streaming Tier', 1), customFormat('HDR10', 2)],
				'radarr'
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.missing, [{ name: 'HD Movies' }]);
			assertEquals(result.diff.modified, []);
		});

		this.test('ignores profile ids and resolves custom format rows through actual Arr ids', () => {
			const result = compareQualityProfileDrift(
				[
					expectedProfile({
						formatItems: [{ format: 999, name: 'Streaming Tier', score: 100 }],
						managedCustomFormatNames: ['Streaming Tier']
					})
				],
				[
					actualProfile({
						id: 1234,
						formatItems: [{ format: 1, name: 'Streaming Tier', score: 100 }]
					})
				],
				[customFormat('Streaming Tier', 1)],
				'radarr'
			);

			assertEquals(result.count, 0);
		});

		this.test('reports managed profile setting mismatches', () => {
			const result = compareQualityProfileDrift(
				[expectedProfile({})],
				[
					actualProfile({
						upgradeAllowed: false,
						cutoff: 3,
						minFormatScore: 10,
						cutoffFormatScore: 500,
						minUpgradeFormatScore: 25
					})
				],
				[customFormat('Streaming Tier', 1), customFormat('HDR10', 2)],
				'radarr'
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.modified, [
				{
					name: 'HD Movies',
					fields: [
						{ path: 'cutoffFormatScore', expected: 1000, actual: 500 },
						{
							path: 'items',
							expected: [
								{ type: 'quality', id: 3, name: 'WEBDL-1080p', allowed: true, upgradeUntil: false },
								{ type: 'quality', id: 7, name: 'Bluray-1080p', allowed: true, upgradeUntil: true }
							],
							actual: [
								{ type: 'quality', id: 3, name: 'WEBDL-1080p', allowed: true, upgradeUntil: true },
								{ type: 'quality', id: 7, name: 'Bluray-1080p', allowed: true, upgradeUntil: false }
							]
						},
						{ path: 'minFormatScore', expected: 0, actual: 10 },
						{ path: 'minUpgradeFormatScore', expected: 1, actual: 25 },
						{ path: 'upgradeAllowed', expected: true, actual: false }
					]
				}
			]);
		});

		this.test('compares Radarr language', () => {
			const result = compareQualityProfileDrift(
				[expectedProfile({ language: { id: 1, name: 'English' } })],
				[actualProfile({ language: { id: 2, name: 'French' } })],
				[customFormat('Streaming Tier', 1), customFormat('HDR10', 2)],
				'radarr'
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.modified, [
				{
					name: 'HD Movies',
					fields: [
						{
							path: 'language',
							expected: { id: 1, name: 'English' },
							actual: { id: 2, name: 'French' }
						}
					]
				}
			]);
		});

		this.test('ignores Sonarr language', () => {
			const result = compareQualityProfileDrift(
				[expectedProfile({ language: undefined })],
				[actualProfile({ language: { id: 2, name: 'French' } })],
				[customFormat('Streaming Tier', 1), customFormat('HDR10', 2)],
				'sonarr'
			);

			assertEquals(result.count, 0);
		});

		this.test('reports quality structure mismatch', () => {
			const expectedItems = [
				groupItem(
					'HD Group',
					1001,
					[qualityItem('WEBDL-1080p', 3), qualityItem('Bluray-1080p', 7)],
					true
				),
				qualityItem('WEBDL-720p', 5, false)
			];
			const actualItems = [
				groupItem(
					'HD Group',
					1001,
					[qualityItem('Bluray-1080p', 7), qualityItem('WEBDL-1080p', 3)],
					true
				),
				qualityItem('WEBDL-720p', 5, true)
			];

			const result = compareQualityProfileDrift(
				[expectedProfile({ items: expectedItems })],
				[actualProfile({ items: actualItems })],
				[customFormat('Streaming Tier', 1), customFormat('HDR10', 2)],
				'radarr'
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.modified[0].fields, [
				{
					path: 'items',
					expected: [
						{
							type: 'group',
							id: 1001,
							name: 'HD Group',
							allowed: true,
							upgradeUntil: false,
							items: [
								{ type: 'quality', id: 3, name: 'WEBDL-1080p', allowed: true, upgradeUntil: false },
								{ type: 'quality', id: 7, name: 'Bluray-1080p', allowed: true, upgradeUntil: true }
							]
						},
						{ type: 'quality', id: 5, name: 'WEBDL-720p', allowed: false, upgradeUntil: false }
					],
					actual: [
						{
							type: 'group',
							id: 1001,
							name: 'HD Group',
							allowed: true,
							upgradeUntil: false,
							items: [
								{ type: 'quality', id: 7, name: 'Bluray-1080p', allowed: true, upgradeUntil: true },
								{ type: 'quality', id: 3, name: 'WEBDL-1080p', allowed: true, upgradeUntil: false }
							]
						},
						{ type: 'quality', id: 5, name: 'WEBDL-720p', allowed: true, upgradeUntil: false }
					]
				}
			]);
		});

		this.test('reports managed custom format missing from scoring array defensively', () => {
			const result = compareQualityProfileDrift(
				[
					expectedProfile({
						formatItems: [{ format: 1, name: 'Streaming Tier', score: 100 }],
						managedCustomFormatNames: ['Streaming Tier']
					})
				],
				[actualProfile({ formatItems: [] })],
				[customFormat('Streaming Tier', 1)],
				'radarr'
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.modified, [
				{
					name: 'HD Movies',
					fields: [
						{
							path: 'formatItems[Streaming Tier]',
							expected: { name: 'Streaming Tier', score: 100 },
							actual: null
						}
					]
				}
			]);
		});

		this.test(
			'reports managed custom format missing from Arr under quality profile scoring',
			() => {
				const result = compareQualityProfileDrift(
					[
						expectedProfile({
							formatItems: [{ format: 1, name: 'Streaming Tier', score: 100 }],
							managedCustomFormatNames: ['Streaming Tier']
						})
					],
					[actualProfile({ formatItems: [] })],
					[],
					'radarr'
				);

				assertEquals(result.count, 1);
				assertEquals(result.diff.modified, [
					{
						name: 'HD Movies',
						fields: [
							{
								path: 'formatItems[Streaming Tier]',
								expected: { name: 'Streaming Tier', score: 100 },
								actual: { name: 'Streaming Tier', state: 'missing_custom_format' }
							}
						]
					}
				]);
			}
		);

		this.test('reports managed custom format score mismatch', () => {
			const result = compareQualityProfileDrift(
				[
					expectedProfile({
						formatItems: [{ format: 1, name: 'Streaming Tier', score: 100 }],
						managedCustomFormatNames: ['Streaming Tier']
					})
				],
				[actualProfile({ formatItems: [{ format: 1, name: 'Streaming Tier', score: 75 }] })],
				[customFormat('Streaming Tier', 1)],
				'radarr'
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.modified, [
				{
					name: 'HD Movies',
					fields: [
						{
							path: 'formatItems[Streaming Tier]',
							expected: { name: 'Streaming Tier', score: 100 },
							actual: { name: 'Streaming Tier', score: 75 }
						}
					]
				}
			]);
		});

		this.test('ignores unmanaged Arr custom format scoring rows with zero score', () => {
			const result = compareQualityProfileDrift(
				[
					expectedProfile({
						formatItems: [{ format: 1, name: 'Streaming Tier', score: 100 }],
						managedCustomFormatNames: ['Streaming Tier']
					})
				],
				[
					actualProfile({
						formatItems: [
							{ format: 1, name: 'Streaming Tier', score: 100 },
							{ format: 2, name: 'Unmanaged', score: 0 }
						]
					})
				],
				[customFormat('Streaming Tier', 1), customFormat('Unmanaged', 2)],
				'radarr'
			);

			assertEquals(result.count, 0);
		});

		this.test('reports unmanaged Arr custom format scoring rows with nonzero score', () => {
			const result = compareQualityProfileDrift(
				[
					expectedProfile({
						formatItems: [{ format: 1, name: 'Streaming Tier', score: 100 }],
						managedCustomFormatNames: ['Streaming Tier']
					})
				],
				[
					actualProfile({
						formatItems: [
							{ format: 1, name: 'Streaming Tier', score: 100 },
							{ format: 2, name: 'Unmanaged', score: 999 }
						]
					})
				],
				[customFormat('Streaming Tier', 1), customFormat('Unmanaged', 2)],
				'radarr'
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.modified, [
				{
					name: 'HD Movies',
					fields: [
						{
							path: 'formatItems[Unmanaged]',
							expected: { name: 'Unmanaged', score: 0, state: 'unmanaged' },
							actual: { name: 'Unmanaged', score: 999 }
						}
					]
				}
			]);
		});

		this.test('compares managed custom format with expected zero score', () => {
			const result = compareQualityProfileDrift(
				[
					expectedProfile({
						formatItems: [{ format: 1, name: 'Streaming Tier', score: 0 }],
						managedCustomFormatNames: ['Streaming Tier']
					})
				],
				[actualProfile({ formatItems: [{ format: 1, name: 'Streaming Tier', score: 10 }] })],
				[customFormat('Streaming Tier', 1)],
				'radarr'
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.modified, [
				{
					name: 'HD Movies',
					fields: [
						{
							path: 'formatItems[Streaming Tier]',
							expected: { name: 'Streaming Tier', score: 0 },
							actual: { name: 'Streaming Tier', score: 10 }
						}
					]
				}
			]);
		});

		this.test('sorts profiles and fields for stable drift output', () => {
			const result = compareQualityProfileDrift(
				[expectedProfile({ name: 'Z Profile' }), expectedProfile({ name: 'A Profile' })],
				[
					actualProfile({
						name: 'Z Profile',
						cutoff: 3,
						minFormatScore: 10
					}),
					actualProfile({
						name: 'A Profile',
						upgradeAllowed: false
					})
				],
				[customFormat('Streaming Tier', 1), customFormat('HDR10', 2)],
				'radarr'
			);

			assertEquals(
				result.diff.modified.map((item) => item.name),
				['A Profile', 'Z Profile']
			);
			assertEquals(
				result.diff.modified
					.find((item) => item.name === 'Z Profile')
					?.fields.map((field) => field.path),
				['items', 'minFormatScore']
			);
		});

		this.test('hash is stable for equivalent object key order', async () => {
			const first: QualityProfileDriftDiff = {
				missing: [],
				modified: [
					{
						name: 'HD Movies',
						fields: [
							{
								path: 'formatItems[Streaming Tier]',
								expected: { name: 'Streaming Tier', score: 100 },
								actual: { name: 'Streaming Tier', score: 75 }
							}
						]
					}
				]
			};
			const second = {
				modified: [
					{
						fields: [
							{
								actual: { score: 75, name: 'Streaming Tier' },
								expected: { score: 100, name: 'Streaming Tier' },
								path: 'formatItems[Streaming Tier]'
							}
						],
						name: 'HD Movies'
					}
				],
				missing: []
			};

			assertEquals(
				await hashDriftDiff({ quality_profiles: first }),
				await hashDriftDiff({ quality_profiles: second })
			);
		});
	}
}

const qualityProfileDriftTest = new QualityProfileDriftTest();
qualityProfileDriftTest.runTests();
