import { assertEquals } from '@std/assert';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { LANDING_PAGES, isLandingPage, resolveLandingPage } from '#shared/landingPages.ts';

class LandingPagesTest extends BaseTest {
	runTests(): void {
		this.test('resolveLandingPage opens a chosen page even with no database linked', () => {
			for (const page of LANDING_PAGES) {
				assertEquals(resolveLandingPage(page.id, false), page.path);
				assertEquals(resolveLandingPage(page.id, true), page.path);
			}
		});

		this.test('resolveLandingPage defaults to Databases until a database is linked', () => {
			assertEquals(resolveLandingPage(null, false), '/databases');
			assertEquals(resolveLandingPage(undefined, false), '/databases');
			assertEquals(resolveLandingPage(null, true), '/quality-profiles');
		});

		this.test('resolveLandingPage falls back to the default for unknown pages', () => {
			assertEquals(resolveLandingPage('dashboard', false), '/databases');
			assertEquals(resolveLandingPage('dashboard', true), '/quality-profiles');
			assertEquals(resolveLandingPage('', true), '/quality-profiles');
		});

		this.test('isLandingPage accepts page ids only', () => {
			assertEquals(isLandingPage('quality-profiles'), true);
			assertEquals(isLandingPage('arrs'), true);
			assertEquals(isLandingPage('/quality-profiles'), false);
			assertEquals(isLandingPage('dashboard'), false);
			assertEquals(isLandingPage(''), false);
			assertEquals(isLandingPage(null), false);
		});
	}
}

const test = new LandingPagesTest();
test.runTests();
