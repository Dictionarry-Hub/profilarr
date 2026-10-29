/**
 * Size helpers for quality profile items (Sonarr v5 keeps size limits per
 * profile item): reading sizes off a fetched profile, writing a map onto a
 * payload, and the precedence between them.
 */

import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import type { ArrQualityProfileItem, ArrQualityProfileReadItem } from '#arr/types.ts';
import {
	applySizesToItems,
	collectItemSizes,
	definitionsToSizeMap,
	mergeSizes,
	resolveDefinitionSizes,
	resolveProfileSizes,
	type QualitySizeMap
} from '#server/sync/qualityProfiles/sizes.ts';

function payloadQuality(name: string, id: number): ArrQualityProfileItem {
	return { quality: { id, name, source: 'web', resolution: 1080 }, items: [], allowed: true };
}

function payloadGroup(
	name: string,
	id: number,
	members: ArrQualityProfileItem[]
): ArrQualityProfileItem {
	return { id, name, items: members, allowed: true };
}

const sizes = (minSize: number | null, maxSize: number | null, preferredSize: number | null) => ({
	minSize,
	maxSize,
	preferredSize
});

class QualityProfileSizesTest extends BaseTest {
	runTests(): void {
		this.test(
			'collectItemSizes reads quality rows and group members, keyed case-insensitively',
			() => {
				const fetched: ArrQualityProfileReadItem[] = [
					{
						quality: { id: 3, name: 'WEBDL-1080p' },
						allowed: true,
						minSize: 4,
						maxSize: 125,
						preferredSize: 95
					},
					{
						id: 1001,
						name: 'HD',
						allowed: true,
						items: [
							{
								quality: { id: 9, name: 'HDTV-1080p' },
								allowed: true,
								minSize: 2,
								maxSize: null,
								preferredSize: 50
							}
						]
					}
				];
				const result = collectItemSizes(fetched);
				expect(result.get('webdl-1080p')).toStrictEqual(sizes(4, 125, 95));
				expect(result.get('hdtv-1080p')).toStrictEqual(sizes(2, null, 50));
				expect(result.has('hd'), 'group rows carry no sizes').toStrictEqual(false);
			}
		);

		this.test('collectItemSizes treats a missing key as null', () => {
			const result = collectItemSizes([{ quality: { id: 3, name: 'WEBDL-1080p' }, allowed: true }]);
			expect(result.get('webdl-1080p')).toStrictEqual(sizes(null, null, null));
		});

		this.test('applySizesToItems writes onto quality rows and members, not group rows', () => {
			const member = payloadQuality('HDTV-1080p', 9);
			const group = payloadGroup('HD', 1001, [member]);
			const single = payloadQuality('WEBDL-1080p', 3);
			const untouched = payloadQuality('SDTV', 1);
			const map: QualitySizeMap = new Map([
				['webdl-1080p', sizes(4, 125, 95)],
				['hdtv-1080p', sizes(2, null, 50)]
			]);

			const applied = applySizesToItems([group, single, untouched], map);

			expect(applied).toStrictEqual(2);
			expect(single.minSize).toStrictEqual(4);
			expect(single.maxSize).toStrictEqual(125);
			expect(single.preferredSize).toStrictEqual(95);
			expect(member.minSize).toStrictEqual(2);
			expect(member.maxSize).toStrictEqual(null);
			expect(member.preferredSize).toStrictEqual(50);
			expect('minSize' in group).toStrictEqual(false);
			expect('minSize' in untouched).toStrictEqual(false);
		});

		this.test('mergeSizes lets the override win per quality and keeps the rest', () => {
			const fallback: QualitySizeMap = new Map([
				['webdl-1080p', sizes(4, 125, 95)],
				['sdtv', sizes(1, 10, 5)]
			]);
			const override: QualitySizeMap = new Map([['webdl-1080p', sizes(15, null, 995)]]);

			const merged = mergeSizes(fallback, override);

			expect(merged.get('webdl-1080p')).toStrictEqual(sizes(15, null, 995));
			expect(merged.get('sdtv')).toStrictEqual(sizes(1, 10, 5));
		});

		this.test('resolveProfileSizes: override beats global beats fallback, per quality', () => {
			const fallback: QualitySizeMap = new Map([
				['webdl-1080p', sizes(1, 10, 5)],
				['hdtv-1080p', sizes(1, 10, 5)],
				['sdtv', sizes(1, 10, 5)]
			]);
			const global: QualitySizeMap = new Map([
				['webdl-1080p', sizes(15, null, 995)],
				['hdtv-1080p', sizes(15, null, 995)]
			]);
			const override: QualitySizeMap = new Map([['webdl-1080p', sizes(6, 60, 40)]]);

			const resolved = resolveProfileSizes({ fallback, global, override });

			expect(resolved.get('webdl-1080p'), 'override wins').toStrictEqual(sizes(6, 60, 40));
			expect(resolved.get('hdtv-1080p'), 'global fills the rest').toStrictEqual(
				sizes(15, null, 995)
			);
			expect(resolved.get('sdtv'), 'fallback keeps what neither covers').toStrictEqual(
				sizes(1, 10, 5)
			);
		});

		this.test('resolveProfileSizes without global or override is the fallback', () => {
			const fallback: QualitySizeMap = new Map([['sdtv', sizes(1, 10, 5)]]);
			expect(resolveProfileSizes({ fallback })).toStrictEqual(fallback);
			expect(resolveProfileSizes({ fallback, global: null, override: null })).toStrictEqual(
				fallback
			);
		});

		this.test(
			'resolveDefinitionSizes: override beats global, and qualities neither sets are absent',
			() => {
				const global: QualitySizeMap = new Map([
					['webdl-1080p', sizes(15, null, 995)],
					['hdtv-1080p', sizes(15, null, 995)]
				]);
				const override: QualitySizeMap = new Map([['webdl-1080p', sizes(6, 60, 40)]]);

				const resolved = resolveDefinitionSizes({ global, override });

				expect(resolved.get('webdl-1080p'), 'override wins').toStrictEqual(sizes(6, 60, 40));
				expect(resolved.get('hdtv-1080p'), 'global fills the rest').toStrictEqual(
					sizes(15, null, 995)
				);
				expect(resolved.has('sdtv'), 'no definition sets SDTV').toStrictEqual(false);
				expect(resolveDefinitionSizes({}).size).toStrictEqual(0);
			}
		);

		this.test('definitionsToSizeMap keys mapped definitions by lowercase API name', () => {
			const map = definitionsToSizeMap([
				{ qualityName: 'WEBDL-1080p', fields: sizes(15, null, 995) }
			]);
			expect(map.get('webdl-1080p')).toStrictEqual(sizes(15, null, 995));
		});
	}
}

new QualityProfileSizesTest().runTests();
