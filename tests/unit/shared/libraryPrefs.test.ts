import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import {
	parseBooleanPref,
	parseLibraryDownloadStatusesPref,
	parseLibrarySortPref,
	parseStringSetPref
} from '#shared/utils/libraryPrefs.ts';

class LibraryPrefsTest extends BaseTest {
	runTests(): void {
		this.test('parseBooleanPref returns fallback for missing or invalid values', () => {
			expect(parseBooleanPref(null, false)).toStrictEqual(false);
			expect(parseBooleanPref(null, true)).toStrictEqual(true);
			expect(parseBooleanPref('yes', false)).toStrictEqual(false);
			expect(parseBooleanPref('true', false)).toStrictEqual(true);
			expect(parseBooleanPref('false', true)).toStrictEqual(false);
		});

		const allowed = ['a', 'b', 'c'] as const;
		const defaults = ['a', 'b'] as const;

		this.test('parseStringSetPref returns defaults when missing or malformed', () => {
			expect(parseStringSetPref(null, allowed, defaults)).toStrictEqual(new Set(['a', 'b']));
			expect(parseStringSetPref('not json', allowed, defaults)).toStrictEqual(new Set(['a', 'b']));
			expect(parseStringSetPref('{"a":1}', allowed, defaults)).toStrictEqual(new Set(['a', 'b']));
		});

		this.test('parseStringSetPref drops unknown keys and keeps empty selections', () => {
			expect(parseStringSetPref('["c","removed"]', allowed, defaults)).toStrictEqual(
				new Set(['c'])
			);
			expect(parseStringSetPref('[]', allowed, defaults)).toStrictEqual(new Set());
		});

		this.test('parseLibraryDownloadStatusesPref defaults to both statuses', () => {
			expect(parseLibraryDownloadStatusesPref(null)).toStrictEqual(
				new Set(['downloaded', 'missing'])
			);
			expect(parseLibraryDownloadStatusesPref('["missing"]')).toStrictEqual(new Set(['missing']));
			expect(parseLibraryDownloadStatusesPref('[]')).toStrictEqual(new Set());
		});

		this.test('parseLibrarySortPref accepts valid keys for the instance type', () => {
			expect(parseLibrarySortPref('{"key":"score","direction":"desc"}', 'radarr')).toStrictEqual({
				key: 'score',
				direction: 'desc'
			});
			expect(
				parseLibrarySortPref('{"key":"digitalReleaseDate","direction":"asc"}', 'radarr')
			).toStrictEqual({ key: 'digitalReleaseDate', direction: 'asc' });
			expect(
				parseLibrarySortPref('{"key":"firstAired","direction":"desc"}', 'sonarr')
			).toStrictEqual({
				key: 'firstAired',
				direction: 'desc'
			});
		});

		this.test('parseLibrarySortPref falls back for keys invalid on the instance type', () => {
			const fallback = { key: 'title', direction: 'asc' };
			expect(
				parseLibrarySortPref('{"key":"digitalReleaseDate","direction":"asc"}', 'sonarr')
			).toStrictEqual(fallback);
			expect(
				parseLibrarySortPref('{"key":"firstAired","direction":"asc"}', 'radarr')
			).toStrictEqual(fallback);
		});

		this.test('parseLibrarySortPref falls back for missing or malformed values', () => {
			const fallback = { key: 'title', direction: 'asc' };
			expect(parseLibrarySortPref(null, 'radarr')).toStrictEqual(fallback);
			expect(parseLibrarySortPref('nope', 'radarr')).toStrictEqual(fallback);
			expect(parseLibrarySortPref('["title"]', 'radarr')).toStrictEqual(fallback);
			expect(parseLibrarySortPref('{"key":"title","direction":"up"}', 'radarr')).toStrictEqual(
				fallback
			);
			expect(parseLibrarySortPref('{"key":5,"direction":"asc"}', 'radarr')).toStrictEqual(fallback);
		});
	}
}

const test = new LibraryPrefsTest();
test.runTests();
