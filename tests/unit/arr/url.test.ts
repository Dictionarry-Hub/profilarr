import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { normalizeArrInstanceUrl } from '#shared/utils/arrUrl.ts';

class ArrUrlTest extends BaseTest {
	runTests(): void {
		this.test('removes trailing slash', () => {
			expect(normalizeArrInstanceUrl('http://host:7878/')).toStrictEqual('http://host:7878');
		});

		this.test('ignores query string and hash', () => {
			expect(normalizeArrInstanceUrl('http://host:7878/?x=1#top')).toStrictEqual(
				'http://host:7878'
			);
		});

		this.test('lowercases scheme and hostname', () => {
			expect(normalizeArrInstanceUrl('HTTP://Radarr.Local:7878')).toStrictEqual(
				'http://radarr.local:7878'
			);
		});

		this.test('removes default ports', () => {
			expect(normalizeArrInstanceUrl('http://host:80')).toStrictEqual('http://host');
			expect(normalizeArrInstanceUrl('https://host:443')).toStrictEqual('https://host');
		});

		this.test('preserves non-default port', () => {
			expect(normalizeArrInstanceUrl('http://host:7879')).toStrictEqual('http://host:7879');
		});

		this.test('preserves path', () => {
			expect(normalizeArrInstanceUrl('https://host/radarr/')).toStrictEqual('https://host/radarr');
		});
	}
}

const test = new ArrUrlTest();
test.runTests();
