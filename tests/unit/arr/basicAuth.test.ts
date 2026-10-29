import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { basicAuthPairError } from '#shared/arr/basicAuth.ts';

class BasicAuthPairTest extends BaseTest {
	runTests(): void {
		this.test('accepts both fields', () => {
			expect(basicAuthPairError(true, true)).toStrictEqual(null);
		});

		this.test('accepts neither field', () => {
			expect(basicAuthPairError(false, false)).toStrictEqual(null);
		});

		this.test('rejects a username without a password', () => {
			expect(typeof basicAuthPairError(true, false)).toStrictEqual('string');
		});

		this.test('rejects a password without a username', () => {
			expect(typeof basicAuthPairError(false, true)).toStrictEqual('string');
		});
	}
}

const basicAuthPairTest = new BasicAuthPairTest();
basicAuthPairTest.runTests();
