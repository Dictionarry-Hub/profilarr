import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import { compareOptionalDates } from '../../../src/lib/shared/utils/sort.ts';

class SortTest extends BaseTest {
	runTests(): void {
		const dates = ['2025-04-10T00:00:00Z', undefined, 'invalid', '2024-01-15T00:00:00Z'];

		this.test('sorts optional dates oldest first with unknown dates last', () => {
			assertEquals(
				[...dates].sort((a, b) => compareOptionalDates(a, b, 'asc')),
				['2024-01-15T00:00:00Z', '2025-04-10T00:00:00Z', 'invalid', undefined]
			);
		});

		this.test('sorts optional dates newest first with unknown dates last', () => {
			assertEquals(
				[...dates].sort((a, b) => compareOptionalDates(a, b, 'desc')),
				['2025-04-10T00:00:00Z', '2024-01-15T00:00:00Z', 'invalid', undefined]
			);
		});
	}
}

const test = new SortTest();
test.runTests();
