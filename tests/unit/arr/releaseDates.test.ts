import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { resolveRadarrInitialReleaseDate } from '#arr/releaseDates.ts';
import type { RadarrMovie } from '#arr/types.ts';

function movie(dates: Partial<RadarrMovie>): RadarrMovie {
	return {
		id: 1,
		title: 'Test Movie',
		qualityProfileId: 1,
		hasFile: false,
		...dates
	};
}

class ReleaseDatesTest extends BaseTest {
	runTests(): void {
		this.test('prefers theatrical release over earlier availability dates', () => {
			expect(
				resolveRadarrInitialReleaseDate(
					movie({
						inCinemas: '2025-03-01T00:00:00Z',
						digitalRelease: '2025-02-01T00:00:00Z',
						physicalRelease: '2025-01-01T00:00:00Z'
					})
				)
			).toStrictEqual('2025-03-01T00:00:00Z');
		});

		this.test('uses the earliest digital or physical fallback', () => {
			expect(
				resolveRadarrInitialReleaseDate(
					movie({
						digitalRelease: '2025-04-01T00:00:00Z',
						physicalRelease: '2025-03-01T00:00:00Z'
					})
				)
			).toStrictEqual('2025-03-01T00:00:00Z');
			expect(
				resolveRadarrInitialReleaseDate(
					movie({
						digitalRelease: '2025-02-01T00:00:00Z',
						physicalRelease: '2025-03-01T00:00:00Z'
					})
				)
			).toStrictEqual('2025-02-01T00:00:00Z');
		});

		this.test('uses matching digital and physical fallbacks', () => {
			expect(
				resolveRadarrInitialReleaseDate(
					movie({
						digitalRelease: '2025-03-01T00:00:00Z',
						physicalRelease: '2025-03-01T00:00:00Z'
					})
				)
			).toStrictEqual('2025-03-01T00:00:00Z');
		});

		this.test('skips invalid dates and returns unknown when none are valid', () => {
			expect(
				resolveRadarrInitialReleaseDate(
					movie({ digitalRelease: 'invalid', physicalRelease: '2025-03-01T00:00:00Z' })
				)
			).toStrictEqual('2025-03-01T00:00:00Z');
			expect(resolveRadarrInitialReleaseDate(movie({ inCinemas: 'invalid' }))).toStrictEqual(
				undefined
			);
		});
	}
}

const test = new ReleaseDatesTest();
test.runTests();
