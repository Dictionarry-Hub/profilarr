import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import { resolveRadarrInitialReleaseDate } from '../../../src/lib/server/utils/arr/releaseDates.ts';
import type { RadarrMovie } from '../../../src/lib/server/utils/arr/types.ts';

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
			assertEquals(
				resolveRadarrInitialReleaseDate(
					movie({
						inCinemas: '2025-03-01T00:00:00Z',
						digitalRelease: '2025-02-01T00:00:00Z',
						physicalRelease: '2025-01-01T00:00:00Z'
					})
				),
				'2025-03-01T00:00:00Z'
			);
		});

		this.test('uses the earliest digital or physical fallback', () => {
			assertEquals(
				resolveRadarrInitialReleaseDate(
					movie({
						digitalRelease: '2025-04-01T00:00:00Z',
						physicalRelease: '2025-03-01T00:00:00Z'
					})
				),
				'2025-03-01T00:00:00Z'
			);
			assertEquals(
				resolveRadarrInitialReleaseDate(
					movie({
						digitalRelease: '2025-02-01T00:00:00Z',
						physicalRelease: '2025-03-01T00:00:00Z'
					})
				),
				'2025-02-01T00:00:00Z'
			);
		});

		this.test('uses matching digital and physical fallbacks', () => {
			assertEquals(
				resolveRadarrInitialReleaseDate(
					movie({
						digitalRelease: '2025-03-01T00:00:00Z',
						physicalRelease: '2025-03-01T00:00:00Z'
					})
				),
				'2025-03-01T00:00:00Z'
			);
		});

		this.test('skips invalid dates and returns unknown when none are valid', () => {
			assertEquals(
				resolveRadarrInitialReleaseDate(
					movie({ digitalRelease: 'invalid', physicalRelease: '2025-03-01T00:00:00Z' })
				),
				'2025-03-01T00:00:00Z'
			);
			assertEquals(resolveRadarrInitialReleaseDate(movie({ inCinemas: 'invalid' })), undefined);
		});
	}
}

const test = new ReleaseDatesTest();
test.runTests();
