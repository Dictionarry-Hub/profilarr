import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { compareOptionalDates } from '#shared/utils/sort.ts';

class SortTest extends BaseTest {
	runTests(): void {
		const dates = ['2025-04-10T00:00:00Z', undefined, 'invalid', '2024-01-15T00:00:00Z'];

		this.test('sorts optional dates oldest first with unknown dates last', () => {
			expect([...dates].sort((a, b) => compareOptionalDates(a, b, 'asc'))).toStrictEqual([
				'2024-01-15T00:00:00Z',
				'2025-04-10T00:00:00Z',
				'invalid',
				undefined
			]);
		});

		this.test('sorts optional dates newest first with unknown dates last', () => {
			expect([...dates].sort((a, b) => compareOptionalDates(a, b, 'desc'))).toStrictEqual([
				'2025-04-10T00:00:00Z',
				'2024-01-15T00:00:00Z',
				'invalid',
				undefined
			]);
		});
	}
}

const test = new SortTest();
test.runTests();
