import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import { normalizeArrInstanceUrl } from '../../../src/lib/server/utils/arr/url.ts';

class ArrUrlTest extends BaseTest {
	runTests(): void {
		this.test('removes trailing slash', () => {
			assertEquals(normalizeArrInstanceUrl('http://host:7878/'), 'http://host:7878');
		});

		this.test('ignores query string and hash', () => {
			assertEquals(normalizeArrInstanceUrl('http://host:7878/?x=1#top'), 'http://host:7878');
		});

		this.test('lowercases scheme and hostname', () => {
			assertEquals(normalizeArrInstanceUrl('HTTP://Radarr.Local:7878'), 'http://radarr.local:7878');
		});

		this.test('removes default ports', () => {
			assertEquals(normalizeArrInstanceUrl('http://host:80'), 'http://host');
			assertEquals(normalizeArrInstanceUrl('https://host:443'), 'https://host');
		});

		this.test('preserves non-default port', () => {
			assertEquals(normalizeArrInstanceUrl('http://host:7879'), 'http://host:7879');
		});

		this.test('preserves path', () => {
			assertEquals(normalizeArrInstanceUrl('https://host/radarr/'), 'https://host/radarr');
		});
	}
}

const test = new ArrUrlTest();
test.runTests();
