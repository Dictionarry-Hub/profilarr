import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import { basicAuthHeader } from '$utils/arr/base.ts';

class BasicAuthHeaderTest extends BaseTest {
	runTests(): void {
		this.test('encodes ASCII credentials', () => {
			assertEquals(basicAuthHeader('proxy-user', 'hunter2'), 'Basic cHJveHktdXNlcjpodW50ZXIy');
		});

		// Proxies decode the credentials as UTF-8, as Go's SetBasicAuth sends them
		this.test('encodes non-ASCII credentials as UTF-8', () => {
			assertEquals(
				basicAuthHeader('proxy-user', 'hünter2🔑'),
				'Basic cHJveHktdXNlcjpow7xudGVyMvCflJE='
			);
		});
	}
}

const basicAuthHeaderTest = new BasicAuthHeaderTest();
basicAuthHeaderTest.runTests();
