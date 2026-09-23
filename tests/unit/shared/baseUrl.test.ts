import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import { stripBaseUrl, withBaseUrl } from '../../../src/lib/shared/baseUrl.ts';

class BaseUrlTest extends BaseTest {
	runTests(): void {
		this.test('strips the prefix off incoming request paths', () => {
			assertEquals(stripBaseUrl('/profilarr/settings', '/profilarr'), '/settings');
			assertEquals(stripBaseUrl('/profilarr', '/profilarr'), '/');
			assertEquals(stripBaseUrl('/profilarr/', '/profilarr'), '/');
			assertEquals(stripBaseUrl('/media/profilarr/settings', '/media/profilarr'), '/settings');
		});

		this.test('passes everything through when no base is configured', () => {
			assertEquals(stripBaseUrl('/settings', ''), '/settings');
			assertEquals(stripBaseUrl('/', ''), '/');
		});

		this.test('rejects paths outside the base', () => {
			// Profilarr serves only from its subpath, like Radarr and Sonarr. null tells
			// the adapter to answer with a 404 rather than serving the app twice.
			assertEquals(stripBaseUrl('/settings', '/profilarr'), null);
			assertEquals(stripBaseUrl('/', '/profilarr'), null);
			// Not a segment boundary, so /profilarr-two is a different path.
			assertEquals(stripBaseUrl('/profilarr-two/settings', '/profilarr'), null);
		});

		this.test('prefixes outgoing app paths exactly once', () => {
			assertEquals(withBaseUrl('/auth/login', '/profilarr'), '/profilarr/auth/login');
			assertEquals(withBaseUrl('/profilarr/auth/login', '/profilarr'), '/profilarr/auth/login');
			assertEquals(withBaseUrl('/profilarr', '/profilarr'), '/profilarr');
			assertEquals(withBaseUrl('/auth/login', ''), '/auth/login');
		});

		this.test('leaves external and protocol relative URLs alone', () => {
			assertEquals(
				withBaseUrl('https://idp.example.com/authorize', '/profilarr'),
				'https://idp.example.com/authorize'
			);
			assertEquals(withBaseUrl('//cdn.example.com/x', '/profilarr'), '//cdn.example.com/x');
			assertEquals(withBaseUrl('?/save', '/profilarr'), '?/save');
		});
	}
}

const test = new BaseUrlTest();
test.runTests();
