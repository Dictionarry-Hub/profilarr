import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import {
	parseBooleanPref,
	parseLibraryDownloadStatusesPref,
	parseLibrarySortPref,
	parseStringSetPref
} from '$shared/utils/libraryPrefs.ts';

class LibraryPrefsTest extends BaseTest {
	runTests(): void {
		this.test('parseBooleanPref returns fallback for missing or invalid values', () => {
			assertEquals(parseBooleanPref(null, false), false);
			assertEquals(parseBooleanPref(null, true), true);
			assertEquals(parseBooleanPref('yes', false), false);
			assertEquals(parseBooleanPref('true', false), true);
			assertEquals(parseBooleanPref('false', true), false);
		});

		const allowed = ['a', 'b', 'c'] as const;
		const defaults = ['a', 'b'] as const;

		this.test('parseStringSetPref returns defaults when missing or malformed', () => {
			assertEquals(parseStringSetPref(null, allowed, defaults), new Set(['a', 'b']));
			assertEquals(parseStringSetPref('not json', allowed, defaults), new Set(['a', 'b']));
			assertEquals(parseStringSetPref('{"a":1}', allowed, defaults), new Set(['a', 'b']));
		});

		this.test('parseStringSetPref drops unknown keys and keeps empty selections', () => {
			assertEquals(parseStringSetPref('["c","removed"]', allowed, defaults), new Set(['c']));
			assertEquals(parseStringSetPref('[]', allowed, defaults), new Set());
		});

		this.test('parseLibraryDownloadStatusesPref defaults to both statuses', () => {
			assertEquals(parseLibraryDownloadStatusesPref(null), new Set(['downloaded', 'missing']));
			assertEquals(parseLibraryDownloadStatusesPref('["missing"]'), new Set(['missing']));
			assertEquals(parseLibraryDownloadStatusesPref('[]'), new Set());
		});

		this.test('parseLibrarySortPref accepts valid keys for the instance type', () => {
			assertEquals(parseLibrarySortPref('{"key":"score","direction":"desc"}', 'radarr'), {
				key: 'score',
				direction: 'desc'
			});
			assertEquals(
				parseLibrarySortPref('{"key":"digitalReleaseDate","direction":"asc"}', 'radarr'),
				{ key: 'digitalReleaseDate', direction: 'asc' }
			);
			assertEquals(parseLibrarySortPref('{"key":"firstAired","direction":"desc"}', 'sonarr'), {
				key: 'firstAired',
				direction: 'desc'
			});
		});

		this.test('parseLibrarySortPref falls back for keys invalid on the instance type', () => {
			const fallback = { key: 'title', direction: 'asc' };
			assertEquals(
				parseLibrarySortPref('{"key":"digitalReleaseDate","direction":"asc"}', 'sonarr'),
				fallback
			);
			assertEquals(
				parseLibrarySortPref('{"key":"firstAired","direction":"asc"}', 'radarr'),
				fallback
			);
		});

		this.test('parseLibrarySortPref falls back for missing or malformed values', () => {
			const fallback = { key: 'title', direction: 'asc' };
			assertEquals(parseLibrarySortPref(null, 'radarr'), fallback);
			assertEquals(parseLibrarySortPref('nope', 'radarr'), fallback);
			assertEquals(parseLibrarySortPref('["title"]', 'radarr'), fallback);
			assertEquals(parseLibrarySortPref('{"key":"title","direction":"up"}', 'radarr'), fallback);
			assertEquals(parseLibrarySortPref('{"key":5,"direction":"asc"}', 'radarr'), fallback);
		});
	}
}

const test = new LibraryPrefsTest();
test.runTests();
