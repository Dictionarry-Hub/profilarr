import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import {
	compareDelayProfileDrift,
	type DelayProfileDriftDiff,
	type DelayProfileDriftExpected
} from '#server/drift/delayProfiles.ts';
import { buildDriftDisplayEntities } from '#server/drift/display.ts';
import { hashDriftDiff } from '#server/drift/hash.ts';
import type { ArrDelayProfile } from '#arr/types.ts';

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

			expect(result.count).toStrictEqual(0);
			expect(result.diff).toStrictEqual({ missing: [], modified: [] });
		});

		this.test('clean when no delay profile is configured', () => {
			const result = compareDelayProfileDrift(null, [
				arrDelayProfile({ id: 1 }),
				arrDelayProfile({ id: 2, usenetDelay: 999 })
			]);

			expect(result.count).toStrictEqual(0);
			expect(result.diff).toStrictEqual({ missing: [], modified: [] });
		});

		this.test('reports missing Arr default delay profile', () => {
			const result = compareDelayProfileDrift(expectedDelayProfile(), [arrDelayProfile({ id: 2 })]);

			expect(result.count).toStrictEqual(1);
			expect(result.diff.missing).toStrictEqual([{ name: 'Standard Delay' }]);
			expect(result.diff.modified).toStrictEqual([]);
		});

		this.test('reports protocol mismatch from managed Arr protocol fields', () => {
			const result = compareDelayProfileDrift(expectedDelayProfile(), [
				arrDelayProfile({
					enableUsenet: false,
					enableTorrent: true,
					preferredProtocol: 'torrent'
				})
			]);

			expect(result.count).toStrictEqual(1);
			expect(result.diff.modified).toStrictEqual([
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

			expect(result.count).toStrictEqual(1);
			expect(result.diff.modified).toStrictEqual([
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

			expect(result.count).toStrictEqual(0);
			expect(result.diff).toStrictEqual({ missing: [], modified: [] });
		});

		this.test('displays delay drift in days, hours, and minutes', () => {
			const result = compareDelayProfileDrift(
				expectedDelayProfile({ usenetDelay: 20160, torrentDelay: 1800 }),
				[arrDelayProfile({ usenetDelay: 30, torrentDelay: 0 })]
			);
			const entities = buildDriftDisplayEntities({ delay_profiles: result.diff }, 'radarr');

			expect(entities.length).toStrictEqual(1);
			expect(
				entities[0].changes.map((change) => ({
					label: change.label,
					expected: change.expected?.text,
					actual: change.actual?.text
				}))
			).toStrictEqual([
				{ label: 'Usenet Delay', expected: '14 days', actual: '30 minutes' },
				{ label: 'Torrent Delay', expected: '1 day 6 hours', actual: '0 minutes' }
			]);
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

			expect(await hashDriftDiff({ delay_profiles: first })).toStrictEqual(
				await hashDriftDiff({ delay_profiles: second })
			);
		});
	}
}

const delayProfileDriftTest = new DelayProfileDriftTest();
delayProfileDriftTest.runTests();
