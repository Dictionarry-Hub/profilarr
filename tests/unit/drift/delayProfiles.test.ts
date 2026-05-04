import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import {
	compareDelayProfileDrift,
	type DelayProfileDriftDiff,
	type DelayProfileDriftExpected
} from '$drift/delayProfiles.ts';
import { hashDriftDiff } from '$drift/hash.ts';
import type { ArrDelayProfile } from '$arr/types.ts';

function arrDelayProfile(input: Partial<ArrDelayProfile> = {}): ArrDelayProfile {
	return {
		id: input.id ?? 1,
		enableUsenet: input.enableUsenet ?? true,
		enableTorrent: input.enableTorrent ?? true,
		preferredProtocol: input.preferredProtocol ?? 'usenet',
		usenetDelay: input.usenetDelay ?? 10,
		torrentDelay: input.torrentDelay ?? 20,
		bypassIfHighestQuality: input.bypassIfHighestQuality ?? true,
		bypassIfAboveCustomFormatScore: input.bypassIfAboveCustomFormatScore ?? true,
		minimumCustomFormatScore: input.minimumCustomFormatScore ?? 500,
		order: input.order ?? 2147483647,
		tags: input.tags ?? []
	};
}

function expectedDelayProfile(
	input: Partial<ArrDelayProfile> & { name?: string } = {}
): DelayProfileDriftExpected {
	return {
		name: input.name ?? 'Standard Delay',
		profile: arrDelayProfile(input)
	};
}

class DelayProfileDriftTest extends BaseTest {
	runTests(): void {
		this.test('clean when expected and actual default delay profile match', () => {
			const result = compareDelayProfileDrift(expectedDelayProfile(), [arrDelayProfile()]);

			assertEquals(result.count, 0);
			assertEquals(result.diff, { missing: [], modified: [] });
		});

		this.test('clean when no delay profile is configured', () => {
			const result = compareDelayProfileDrift(null, [
				arrDelayProfile({ id: 1 }),
				arrDelayProfile({ id: 2, usenetDelay: 999 })
			]);

			assertEquals(result.count, 0);
			assertEquals(result.diff, { missing: [], modified: [] });
		});

		this.test('reports missing Arr default delay profile', () => {
			const result = compareDelayProfileDrift(expectedDelayProfile(), [
				arrDelayProfile({ id: 2 })
			]);

			assertEquals(result.count, 1);
			assertEquals(result.diff.missing, [{ name: 'Standard Delay' }]);
			assertEquals(result.diff.modified, []);
		});

		this.test('reports protocol mismatch from managed Arr protocol fields', () => {
			const result = compareDelayProfileDrift(expectedDelayProfile(), [
				arrDelayProfile({
					enableUsenet: false,
					enableTorrent: true,
					preferredProtocol: 'torrent'
				})
			]);

			assertEquals(result.count, 1);
			assertEquals(result.diff.modified, [
				{
					name: 'Standard Delay',
					fields: [{ path: 'protocol', expected: 'prefer_usenet', actual: 'only_torrent' }]
				}
			]);
		});

		this.test('reports managed delay profile field mismatches', () => {
			const result = compareDelayProfileDrift(expectedDelayProfile(), [
				arrDelayProfile({
					enableUsenet: false,
					enableTorrent: true,
					preferredProtocol: 'torrent',
					usenetDelay: 5,
					torrentDelay: 0,
					bypassIfHighestQuality: false,
					bypassIfAboveCustomFormatScore: false,
					minimumCustomFormatScore: 0,
					order: 2,
					tags: [9]
				})
			]);

			assertEquals(result.count, 1);
			assertEquals(result.diff.modified, [
				{
					name: 'Standard Delay',
					fields: [
						{ path: 'protocol', expected: 'prefer_usenet', actual: 'only_torrent' },
						{ path: 'usenetDelay', expected: 10, actual: 5 },
						{ path: 'torrentDelay', expected: 20, actual: 0 },
						{ path: 'bypassIfHighestQuality', expected: true, actual: false },
						{ path: 'bypassIfAboveCustomFormatScore', expected: true, actual: false },
						{ path: 'minimumCustomFormatScore', expected: 500, actual: 0 },
						{ path: 'order', expected: 2147483647, actual: 2 },
						{ path: 'tags', expected: [], actual: [9] }
					]
				}
			]);
		});

		this.test('ignores non-default extra Arr delay profiles', () => {
			const result = compareDelayProfileDrift(expectedDelayProfile(), [
				arrDelayProfile(),
				arrDelayProfile({ id: 2, usenetDelay: 999, tags: [1, 2] })
			]);

			assertEquals(result.count, 0);
			assertEquals(result.diff, { missing: [], modified: [] });
		});

		this.test('hash is stable for equivalent object key order', async () => {
			const first: DelayProfileDriftDiff = {
				missing: [],
				modified: [
					{
						name: 'Standard Delay',
						fields: [{ path: 'usenetDelay', expected: 10, actual: 5 }]
					}
				]
			};
			const second = {
				modified: [
					{
						fields: [{ actual: 5, expected: 10, path: 'usenetDelay' }],
						name: 'Standard Delay'
					}
				],
				missing: []
			};

			assertEquals(
				await hashDriftDiff({ delay_profiles: first }),
				await hashDriftDiff({ delay_profiles: second })
			);
		});
	}
}

const delayProfileDriftTest = new DelayProfileDriftTest();
delayProfileDriftTest.runTests();
