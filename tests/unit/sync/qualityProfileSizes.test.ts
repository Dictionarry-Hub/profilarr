/**
 * Size helpers for quality profile items (Sonarr v5 keeps size limits per
 * profile item): reading sizes off a fetched profile, writing a map onto a
 * payload, and the precedence between them.
 */

import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import type { ArrQualityProfileItem, ArrQualityProfileReadItem } from '$arr/types.ts';
import {
	applySizesToItems,
	collectItemSizes,
	definitionsToSizeMap,
	mergeSizes,
	resolveDefinitionSizes,
	resolveProfileSizes,
	type QualitySizeMap
} from '$sync/qualityProfiles/sizes.ts';

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
				assertEquals(result.get('webdl-1080p'), sizes(4, 125, 95));
				assertEquals(result.get('hdtv-1080p'), sizes(2, null, 50));
				assertEquals(result.has('hd'), false, 'group rows carry no sizes');
			}
		);

		this.test('collectItemSizes treats a missing key as null', () => {
			const result = collectItemSizes([{ quality: { id: 3, name: 'WEBDL-1080p' }, allowed: true }]);
			assertEquals(result.get('webdl-1080p'), sizes(null, null, null));
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

			assertEquals(applied, 2);
			assertEquals(single.minSize, 4);
			assertEquals(single.maxSize, 125);
			assertEquals(single.preferredSize, 95);
			assertEquals(member.minSize, 2);
			assertEquals(member.maxSize, null);
			assertEquals(member.preferredSize, 50);
			assertEquals('minSize' in group, false);
			assertEquals('minSize' in untouched, false);
		});

		this.test('mergeSizes lets the override win per quality and keeps the rest', () => {
			const fallback: QualitySizeMap = new Map([
				['webdl-1080p', sizes(4, 125, 95)],
				['sdtv', sizes(1, 10, 5)]
			]);
			const override: QualitySizeMap = new Map([['webdl-1080p', sizes(15, null, 995)]]);

			const merged = mergeSizes(fallback, override);

			assertEquals(merged.get('webdl-1080p'), sizes(15, null, 995));
			assertEquals(merged.get('sdtv'), sizes(1, 10, 5));
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

			assertEquals(resolved.get('webdl-1080p'), sizes(6, 60, 40), 'override wins');
			assertEquals(resolved.get('hdtv-1080p'), sizes(15, null, 995), 'global fills the rest');
			assertEquals(resolved.get('sdtv'), sizes(1, 10, 5), 'fallback keeps what neither covers');
		});

		this.test('resolveProfileSizes without global or override is the fallback', () => {
			const fallback: QualitySizeMap = new Map([['sdtv', sizes(1, 10, 5)]]);
			assertEquals(resolveProfileSizes({ fallback }), fallback);
			assertEquals(resolveProfileSizes({ fallback, global: null, override: null }), fallback);
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

				assertEquals(resolved.get('webdl-1080p'), sizes(6, 60, 40), 'override wins');
				assertEquals(resolved.get('hdtv-1080p'), sizes(15, null, 995), 'global fills the rest');
				assertEquals(resolved.has('sdtv'), false, 'no definition sets SDTV');
				assertEquals(resolveDefinitionSizes({}).size, 0);
			}
		);

		this.test('definitionsToSizeMap keys mapped definitions by lowercase API name', () => {
			const map = definitionsToSizeMap([
				{ qualityName: 'WEBDL-1080p', fields: sizes(15, null, 995) }
			]);
			assertEquals(map.get('webdl-1080p'), sizes(15, null, 995));
		});
	}
}

new QualityProfileSizesTest().runTests();
