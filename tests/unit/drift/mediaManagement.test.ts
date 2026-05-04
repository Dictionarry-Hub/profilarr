import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import {
	compareMediaManagementDrift,
	type MediaManagementDriftDiff,
	type MediaSettingsDriftExpected
} from '$drift/mediaManagement.ts';
import { hashDriftDiff } from '$drift/hash.ts';
import type { ArrMediaManagementConfig } from '$arr/types.ts';
import { transformMediaSettings } from '$sync/mediaManagement/transformer.ts';

function expectedMediaSettings(
	input: Partial<MediaSettingsDriftExpected> = {}
): MediaSettingsDriftExpected {
	return {
		name: input.name ?? 'Standard Media Settings',
		downloadPropersAndRepacks: input.downloadPropersAndRepacks ?? 'preferAndUpgrade',
		enableMediaInfo: input.enableMediaInfo ?? true
	};
}

function actualMediaSettings(
	input: Partial<ArrMediaManagementConfig> = {}
): ArrMediaManagementConfig {
	return {
		id: input.id ?? 1,
		downloadPropersAndRepacks: input.downloadPropersAndRepacks ?? 'preferAndUpgrade',
		enableMediaInfo: input.enableMediaInfo ?? true,
		...input
	};
}

class MediaManagementDriftTest extends BaseTest {
	runTests(): void {
		this.test('clean when no media settings are configured', () => {
			const result = compareMediaManagementDrift(null, actualMediaSettings());

			assertEquals(result.count, 0);
			assertEquals(result.diff, { media_settings: { missing: [], modified: [] } });
		});

		this.test('clean when expected and actual media settings match', () => {
			const result = compareMediaManagementDrift(
				expectedMediaSettings(),
				actualMediaSettings({ untouchedArrField: 'preserved' })
			);

			assertEquals(result.count, 0);
			assertEquals(result.diff, { media_settings: { missing: [], modified: [] } });
		});

		this.test('normalizes doNotUpgradeAutomatically to Arr doNotUpgrade', () => {
			const result = transformMediaSettings({
				propers_repacks: 'doNotUpgradeAutomatically',
				enable_media_info: true
			});

			assertEquals(result.downloadPropersAndRepacks, 'doNotUpgrade');
		});

		this.test('reports propers and repacks mismatch', () => {
			const result = compareMediaManagementDrift(
				expectedMediaSettings({ downloadPropersAndRepacks: 'doNotUpgrade' }),
				actualMediaSettings({ downloadPropersAndRepacks: 'doNotPrefer' })
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.media_settings.modified, [
				{
					name: 'Standard Media Settings',
					fields: [
						{
							path: 'downloadPropersAndRepacks',
							expected: 'doNotUpgrade',
							actual: 'doNotPrefer'
						}
					]
				}
			]);
		});

		this.test('reports enable media info mismatch', () => {
			const result = compareMediaManagementDrift(
				expectedMediaSettings({ enableMediaInfo: false }),
				actualMediaSettings({ enableMediaInfo: true })
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.media_settings.modified, [
				{
					name: 'Standard Media Settings',
					fields: [{ path: 'enableMediaInfo', expected: false, actual: true }]
				}
			]);
		});

		this.test('hash is stable for equivalent object key order', async () => {
			const first: MediaManagementDriftDiff = {
				media_settings: {
					missing: [],
					modified: [
						{
							name: 'Standard Media Settings',
							fields: [{ path: 'enableMediaInfo', expected: false, actual: true }]
						}
					]
				}
			};
			const second = {
				media_settings: {
					modified: [
						{
							fields: [{ actual: true, expected: false, path: 'enableMediaInfo' }],
							name: 'Standard Media Settings'
						}
					],
					missing: []
				}
			};

			assertEquals(
				await hashDriftDiff({ media_management: first }),
				await hashDriftDiff({ media_management: second })
			);
		});
	}
}

const mediaManagementDriftTest = new MediaManagementDriftTest();
mediaManagementDriftTest.runTests();
