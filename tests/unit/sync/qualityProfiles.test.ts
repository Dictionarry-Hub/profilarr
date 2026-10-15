/**
 * The quality profile transformer with and without a size map. Without one
 * the payload must carry no size keys at all (Sonarr v4, Radarr). With one,
 * sizes land on quality rows and group members and nowhere else.
 */

import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import type { ArrQualityProfileItem } from '$arr/types.ts';
import {
	transformQualityProfile,
	type PcdQualityProfile
} from '$sync/qualityProfiles/transformer.ts';
import type { QualitySizeMap } from '$sync/qualityProfiles/sizes.ts';

function profile(): PcdQualityProfile {
	return {
		id: 1,
		name: '1080p Quality',
		upgradesAllowed: true,
		minimumCustomFormatScore: 0,
		upgradeUntilScore: 100,
		upgradeScoreIncrement: 1,
		qualities: [
			{
				type: 'quality',
				referenceId: 3,
				name: 'WEBDL-1080p',
				position: 0,
				enabled: true,
				upgradeUntil: true
			},
			{
				type: 'group',
				referenceId: 1,
				name: 'HD',
				position: 1,
				enabled: true,
				upgradeUntil: false,
				members: [
					{ id: 9, name: 'HDTV-1080p' },
					{ id: 8, name: 'WEBRip-1080p' }
				]
			}
		],
		language: null,
		customFormats: []
	};
}

function flatten(items: ArrQualityProfileItem[]): ArrQualityProfileItem[] {
	return items.flatMap((item) => [item, ...flatten(item.items)]);
}

function byName(items: ArrQualityProfileItem[], name: string): ArrQualityProfileItem {
	const found = flatten(items).find((item) => item.quality?.name === name || item.name === name);
	if (!found) throw new Error(`item ${name} not found`);
	return found;
}

class QualityProfileTransformerTest extends BaseTest {
	runTests(): void {
		this.test('without a size map no item carries size keys', () => {
			const result = transformQualityProfile(profile(), 'sonarr', new Map(), new Map());
			for (const item of flatten(result.items)) {
				assertEquals('minSize' in item, false);
				assertEquals('maxSize' in item, false);
				assertEquals('preferredSize' in item, false);
			}
		});

		this.test('with a size map, quality rows and group members get sizes', () => {
			const sizes: QualitySizeMap = new Map([
				['webdl-1080p', { minSize: 15, maxSize: null, preferredSize: 995 }],
				['hdtv-1080p', { minSize: 4, maxSize: 125, preferredSize: 95 }]
			]);
			const result = transformQualityProfile(profile(), 'sonarr', new Map(), new Map(), sizes);

			const single = byName(result.items, 'WEBDL-1080p');
			assertEquals(single.minSize, 15);
			assertEquals(single.maxSize, null);
			assertEquals(single.preferredSize, 995);

			const member = byName(result.items, 'HDTV-1080p');
			assertEquals(member.minSize, 4);
			assertEquals(member.maxSize, 125);
			assertEquals(member.preferredSize, 95);

			const group = byName(result.items, 'HD');
			assertEquals('minSize' in group, false, 'group rows carry no sizes');

			const unmapped = byName(result.items, 'WEBRip-1080p');
			assertEquals('minSize' in unmapped, false, 'qualities not in the map are untouched');
		});

		this.test('the rest of the payload is unchanged by the size map', () => {
			const plain = transformQualityProfile(profile(), 'sonarr', new Map(), new Map());
			const sized = transformQualityProfile(
				profile(),
				'sonarr',
				new Map(),
				new Map(),
				new Map([['webdl-1080p', { minSize: 1, maxSize: 2, preferredSize: 1 }]])
			);
			assertEquals(sized.cutoff, plain.cutoff);
			assertEquals(sized.items.length, plain.items.length);
			assertEquals(
				sized.items.map((i) => i.quality?.name ?? i.name),
				plain.items.map((i) => i.quality?.name ?? i.name)
			);
		});
	}
}

new QualityProfileTransformerTest().runTests();
