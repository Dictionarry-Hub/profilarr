import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { LANDING_PAGES, isLandingPage, resolveLandingPage } from '#shared/landingPages.ts';

class LandingPagesTest extends BaseTest {
	runTests(): void {
		this.test('resolveLandingPage opens a chosen page even with no database linked', () => {
			for (const page of LANDING_PAGES) {
				expect(resolveLandingPage(page.id, false)).toStrictEqual(page.path);
				expect(resolveLandingPage(page.id, true)).toStrictEqual(page.path);
			}
		});

		this.test('resolveLandingPage defaults to Databases until a database is linked', () => {
			expect(resolveLandingPage(null, false)).toStrictEqual('/databases');
			expect(resolveLandingPage(undefined, false)).toStrictEqual('/databases');
			expect(resolveLandingPage(null, true)).toStrictEqual('/quality-profiles');
		});

		this.test('resolveLandingPage falls back to the default for unknown pages', () => {
			expect(resolveLandingPage('dashboard', false)).toStrictEqual('/databases');
			expect(resolveLandingPage('dashboard', true)).toStrictEqual('/quality-profiles');
			expect(resolveLandingPage('', true)).toStrictEqual('/quality-profiles');
		});

		this.test('isLandingPage accepts page ids only', () => {
			expect(isLandingPage('quality-profiles')).toStrictEqual(true);
			expect(isLandingPage('arrs')).toStrictEqual(true);
			expect(isLandingPage('/quality-profiles')).toStrictEqual(false);
			expect(isLandingPage('dashboard')).toStrictEqual(false);
			expect(isLandingPage('')).toStrictEqual(false);
			expect(isLandingPage(null)).toStrictEqual(false);
		});
	}
}

const test = new LandingPagesTest();
test.runTests();
