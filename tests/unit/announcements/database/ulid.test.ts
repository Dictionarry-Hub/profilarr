/**
 * Tests for the in-house ULID generator.
 *
 * Verifies format (length + Crockford alphabet), uniqueness, and that
 * sequentially-generated ULIDs sort lexicographically by creation time.
 */

import { BaseTest } from '../../base/BaseTest.ts';
import { assertEquals } from '@std/assert';
import { generateUlid } from '$shared/utils/ulid.ts';

const CROCKFORD_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

class UlidTest extends BaseTest {
	runTests(): void {
		this.test('returns a 26-char Crockford Base32 string', () => {
			const id = generateUlid();
			assertEquals(id.length, 26);
			assertEquals(CROCKFORD_RE.test(id), true);
		});

		this.test('100 generated ulids are all unique', () => {
			const seen = new Set<string>();
			for (let i = 0; i < 100; i++) seen.add(generateUlid());
			assertEquals(seen.size, 100);
		});

		this.test('time-half encodes the current millisecond', () => {
			const before = Date.now();
			const id = generateUlid();
			const after = Date.now();

			// Decode the time prefix back from Crockford Base32.
			const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
			let decoded = 0;
			for (const ch of id.slice(0, 10)) {
				decoded = decoded * 32 + CROCKFORD.indexOf(ch);
			}

			assertEquals(decoded >= before, true);
			assertEquals(decoded <= after, true);
		});

		this.test('ulids generated across milliseconds sort lexicographically by time', async () => {
			const a = generateUlid();
			await new Promise((resolve) => setTimeout(resolve, 5));
			const b = generateUlid();
			assertEquals(a < b, true);
		});
	}
}

const suite = new UlidTest();
suite.runTests();
