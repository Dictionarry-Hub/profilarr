import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { basicAuthHeader } from '#arr/base.ts';

class BasicAuthHeaderTest extends BaseTest {
	runTests(): void {
		this.test('encodes ASCII credentials', () => {
			expect(basicAuthHeader('proxy-user', 'hunter2')).toStrictEqual(
				'Basic cHJveHktdXNlcjpodW50ZXIy'
			);
		});

		// Proxies decode the credentials as UTF-8, as Go's SetBasicAuth sends them
		this.test('encodes non-ASCII credentials as UTF-8', () => {
			expect(basicAuthHeader('proxy-user', 'hünter2🔑')).toStrictEqual(
				'Basic cHJveHktdXNlcjpow7xudGVyMvCflJE='
			);
		});
	}
}

const basicAuthHeaderTest = new BasicAuthHeaderTest();
basicAuthHeaderTest.runTests();
