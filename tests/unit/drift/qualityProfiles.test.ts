import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import {
	compareQualityProfileDrift,
	type QualityProfileDriftDiff,
	type QualityProfileDriftExpected
} from '$drift/qualityProfiles.ts';
import { hashDriftDiff } from '$drift/hash.ts';
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

class QualityProfileDriftTest extends BaseTest {
	runTests(): void {
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
