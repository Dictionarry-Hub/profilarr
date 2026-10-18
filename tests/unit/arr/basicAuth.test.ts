import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import { basicAuthPairError } from '$shared/arr/basicAuth.ts';

class BasicAuthPairTest extends BaseTest {
	runTests(): void {
		this.test('accepts both fields', () => {
			assertEquals(basicAuthPairError(true, true), null);
		});

		this.test('accepts neither field', () => {
			assertEquals(basicAuthPairError(false, false), null);
		});

		this.test('rejects a username without a password', () => {
			assertEquals(typeof basicAuthPairError(true, false), 'string');
		});

		this.test('rejects a password without a username', () => {
			assertEquals(typeof basicAuthPairError(false, true), 'string');
		});
	}
}

const basicAuthPairTest = new BasicAuthPairTest();
basicAuthPairTest.runTests();
