/**
 * Tests for filter evaluation logic
 * Tests evaluateRule() and evaluateGroup() from shared/filters.ts
 */

import { BaseTest } from '../base/BaseTest.ts';
import { assertEquals } from '@std/assert';
import {
	evaluateRule,
	evaluateGroup,
	type FilterRule,
	type FilterGroup
} from '../../../src/lib/shared/upgrades/filters.ts';

class FilterEvaluationTest extends BaseTest {
	runTests(): void {
		// =====================
		// Boolean Operators
		// =====================

		this.test('boolean: is operator matches true', () => {
			const item = { monitored: true };
			const rule: FilterRule = { type: 'rule', field: 'monitored', operator: 'is', value: true };
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('boolean: is operator rejects false', () => {
			const item = { monitored: false };
			const rule: FilterRule = { type: 'rule', field: 'monitored', operator: 'is', value: true };
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('boolean: is_not operator matches', () => {
			const item = { monitored: false };
			const rule: FilterRule = {
				type: 'rule',
				field: 'monitored',
				operator: 'is_not',
				value: true
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('boolean: is_not operator rejects', () => {
			const item = { monitored: true };
			const rule: FilterRule = {
				type: 'rule',
				field: 'monitored',
				operator: 'is_not',
				value: true
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		// =====================
		// Number Operators
		// =====================

		this.test('number: eq operator matches', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'eq', value: 2023 };
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('number: eq operator rejects', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'eq', value: 2024 };
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('number: neq operator matches', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'neq', value: 2024 };
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('number: neq operator rejects', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'neq', value: 2023 };
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('number: gt operator matches', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'gt', value: 2020 };
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('number: gt operator rejects equal value', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'gt', value: 2023 };
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('number: gte operator matches equal value', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'gte', value: 2023 };
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('number: gte operator matches greater value', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'gte', value: 2020 };
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('number: lt operator matches', () => {
			const item = { year: 2020 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'lt', value: 2023 };
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('number: lt operator rejects equal value', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'lt', value: 2023 };
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('number: lte operator matches equal value', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'lte', value: 2023 };
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('number: lte operator matches less value', () => {
			const item = { year: 2020 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'lte', value: 2023 };
			assertEquals(evaluateRule(item, rule), true);
		});

		// =====================
		// Text Operators
		// =====================

		this.test('text: contains operator matches (case insensitive)', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'contains',
				value: 'dark'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('text: contains operator rejects', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'contains',
				value: 'batman'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('text: not_contains operator matches', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'not_contains',
				value: 'batman'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('text: not_contains operator rejects', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'not_contains',
				value: 'dark'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('text: starts_with operator matches (case insensitive)', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'starts_with',
				value: 'the'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('text: starts_with operator rejects', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'starts_with',
				value: 'dark'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('text: ends_with operator matches (case insensitive)', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'ends_with',
				value: 'KNIGHT'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('text: ends_with operator rejects', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'ends_with',
				value: 'dark'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('text: eq operator matches (case insensitive)', () => {
			const item = { quality_profile: 'HD-1080p' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'quality_profile',
				operator: 'eq',
				value: 'hd-1080p'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('text: neq operator matches (case insensitive)', () => {
			const item = { quality_profile: 'HD-1080p' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'quality_profile',
				operator: 'neq',
				value: '4K'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		// =====================
		// Date Operators
		// =====================

		this.test('date: before operator matches', () => {
			const item = { date_added: '2023-01-15T00:00:00Z' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'date_added',
				operator: 'before',
				value: '2023-06-01T00:00:00Z'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('date: before operator rejects', () => {
			const item = { date_added: '2023-06-15T00:00:00Z' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'date_added',
				operator: 'before',
				value: '2023-06-01T00:00:00Z'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('date: after operator matches', () => {
			const item = { date_added: '2023-06-15T00:00:00Z' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'date_added',
				operator: 'after',
				value: '2023-06-01T00:00:00Z'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('date: after operator rejects', () => {
			const item = { date_added: '2023-01-15T00:00:00Z' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'date_added',
				operator: 'after',
				value: '2023-06-01T00:00:00Z'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('date: in_last operator matches recent date', () => {
			const now = new Date();
			const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
			const item = { date_added: fiveDaysAgo.toISOString() };
			const rule: FilterRule = {
				type: 'rule',
				field: 'date_added',
				operator: 'in_last',
				value: 7 // days
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('date: in_last operator rejects old date', () => {
			const now = new Date();
			const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			const item = { date_added: thirtyDaysAgo.toISOString() };
			const rule: FilterRule = {
				type: 'rule',
				field: 'date_added',
				operator: 'in_last',
				value: 7 // days
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('date: not_in_last operator matches old date', () => {
			const now = new Date();
			const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			const item = { date_added: thirtyDaysAgo.toISOString() };
			const rule: FilterRule = {
				type: 'rule',
				field: 'date_added',
				operator: 'not_in_last',
				value: 7 // days
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('date: not_in_last operator rejects recent date', () => {
			const now = new Date();
			const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
			const item = { date_added: fiveDaysAgo.toISOString() };
			const rule: FilterRule = {
				type: 'rule',
				field: 'date_added',
				operator: 'not_in_last',
				value: 7 // days
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		// =====================
		// Ordinal Operators (minimum_availability)
		// =====================
		// Hierarchy: tba(0) → announced(1) → inCinemas(2) → released(3)

		this.test('ordinal: eq operator matches exact value', () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'eq',
				value: 'inCinemas'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('ordinal: eq operator rejects different value', () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'eq',
				value: 'released'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('ordinal: neq operator matches different value', () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'neq',
				value: 'released'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('ordinal: neq operator rejects same value', () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'neq',
				value: 'inCinemas'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('ordinal: gte (has reached) matches same stage', () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'gte',
				value: 'inCinemas'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('ordinal: gte (has reached) matches later stage', () => {
			const item = { minimum_availability: 'released' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'gte',
				value: 'inCinemas'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('ordinal: gte (has reached) rejects earlier stage', () => {
			const item = { minimum_availability: 'announced' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'gte',
				value: 'inCinemas'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test("ordinal: lte (hasn't passed) matches same stage", () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'lte',
				value: 'inCinemas'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test("ordinal: lte (hasn't passed) matches earlier stage", () => {
			const item = { minimum_availability: 'announced' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'lte',
				value: 'inCinemas'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test("ordinal: lte (hasn't passed) rejects later stage", () => {
			const item = { minimum_availability: 'released' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'lte',
				value: 'inCinemas'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('ordinal: gt (is past) matches later stage', () => {
			const item = { minimum_availability: 'released' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'gt',
				value: 'inCinemas'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('ordinal: gt (is past) rejects same stage', () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'gt',
				value: 'inCinemas'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('ordinal: gt (is past) rejects earlier stage', () => {
			const item = { minimum_availability: 'announced' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'gt',
				value: 'inCinemas'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('ordinal: lt (is before) matches earlier stage', () => {
			const item = { minimum_availability: 'announced' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'lt',
				value: 'inCinemas'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('ordinal: lt (is before) rejects same stage', () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'lt',
				value: 'inCinemas'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('ordinal: lt (is before) rejects later stage', () => {
			const item = { minimum_availability: 'released' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'lt',
				value: 'inCinemas'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('ordinal: full hierarchy test - tba is earliest', () => {
			const item = { minimum_availability: 'tba' };
			// tba should be before all others
			assertEquals(
				evaluateRule(item, {
					type: 'rule',
					field: 'minimum_availability',
					operator: 'lt',
					value: 'announced'
				}),
				true
			);
			assertEquals(
				evaluateRule(item, {
					type: 'rule',
					field: 'minimum_availability',
					operator: 'lt',
					value: 'inCinemas'
				}),
				true
			);
			assertEquals(
				evaluateRule(item, {
					type: 'rule',
					field: 'minimum_availability',
					operator: 'lt',
					value: 'released'
				}),
				true
			);
		});

		this.test('ordinal: full hierarchy test - released is latest', () => {
			const item = { minimum_availability: 'released' };
			// released should be past all others
			assertEquals(
				evaluateRule(item, {
					type: 'rule',
					field: 'minimum_availability',
					operator: 'gt',
					value: 'tba'
				}),
				true
			);
			assertEquals(
				evaluateRule(item, {
					type: 'rule',
					field: 'minimum_availability',
					operator: 'gt',
					value: 'announced'
				}),
				true
			);
			assertEquals(
				evaluateRule(item, {
					type: 'rule',
					field: 'minimum_availability',
					operator: 'gt',
					value: 'inCinemas'
				}),
				true
			);
		});

		// =====================
		// Null/Undefined Handling
		// =====================

		this.test('null field: is operator returns false', () => {
			const item = { title: null };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'is',
				value: 'something'
			};
			assertEquals(evaluateRule(item, rule), false);
		});

		this.test('null field: is_not operator returns true', () => {
			const item = { title: null };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'is_not',
				value: 'something'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('undefined field: neq operator returns true', () => {
			const item = { title: 'Test' }; // no 'genres' field
			const rule: FilterRule = {
				type: 'rule',
				field: 'genres',
				operator: 'neq',
				value: 'Action'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		this.test('undefined field: not_contains operator returns true', () => {
			const item = { title: 'Test' }; // no 'genres' field
			const rule: FilterRule = {
				type: 'rule',
				field: 'genres',
				operator: 'not_contains',
				value: 'Action'
			};
			assertEquals(evaluateRule(item, rule), true);
		});

		// =====================
		// Group Evaluation - AND Logic
		// =====================

		this.test('group: empty group matches all items', () => {
			const item = { title: 'Test', year: 2023 };
			const group: FilterGroup = { type: 'group', match: 'all', children: [] };
			assertEquals(evaluateGroup(item, group), true);
		});

		this.test('group: all match - both rules pass', () => {
			const item = { monitored: true, year: 2023 };
			const group: FilterGroup = {
				type: 'group',
				match: 'all',
				children: [
					{ type: 'rule', field: 'monitored', operator: 'is', value: true },
					{ type: 'rule', field: 'year', operator: 'gte', value: 2020 }
				]
			};
			assertEquals(evaluateGroup(item, group), true);
		});

		this.test('group: all match - one rule fails', () => {
			const item = { monitored: false, year: 2023 };
			const group: FilterGroup = {
				type: 'group',
				match: 'all',
				children: [
					{ type: 'rule', field: 'monitored', operator: 'is', value: true },
					{ type: 'rule', field: 'year', operator: 'gte', value: 2020 }
				]
			};
			assertEquals(evaluateGroup(item, group), false);
		});

		// =====================
		// Group Evaluation - OR Logic
		// =====================

		this.test('group: any match - one rule passes', () => {
			const item = { monitored: false, year: 2023 };
			const group: FilterGroup = {
				type: 'group',
				match: 'any',
				children: [
					{ type: 'rule', field: 'monitored', operator: 'is', value: true },
					{ type: 'rule', field: 'year', operator: 'gte', value: 2020 }
				]
			};
			assertEquals(evaluateGroup(item, group), true);
		});

		this.test('group: any match - no rules pass', () => {
			const item = { monitored: false, year: 2015 };
			const group: FilterGroup = {
				type: 'group',
				match: 'any',
				children: [
					{ type: 'rule', field: 'monitored', operator: 'is', value: true },
					{ type: 'rule', field: 'year', operator: 'gte', value: 2020 }
				]
			};
			assertEquals(evaluateGroup(item, group), false);
		});

		// =====================
		// Nested Groups
		// =====================

		this.test('nested groups: AND containing OR', () => {
			// Match: monitored AND (year >= 2020 OR quality_profile = 'HD')
			const item = { monitored: true, year: 2015, quality_profile: 'HD' };
			const group: FilterGroup = {
				type: 'group',
				match: 'all',
				children: [
					{ type: 'rule', field: 'monitored', operator: 'is', value: true },
					{
						type: 'group',
						match: 'any',
						children: [
							{ type: 'rule', field: 'year', operator: 'gte', value: 2020 },
							{ type: 'rule', field: 'quality_profile', operator: 'eq', value: 'HD' }
						]
					}
				]
			};
			assertEquals(evaluateGroup(item, group), true);
		});

		this.test('nested groups: OR containing AND', () => {
			// Match: (monitored AND year >= 2020) OR (quality_profile = '4K')
			const item = { monitored: false, year: 2023, quality_profile: '4K' };
			const group: FilterGroup = {
				type: 'group',
				match: 'any',
				children: [
					{
						type: 'group',
						match: 'all',
						children: [
							{ type: 'rule', field: 'monitored', operator: 'is', value: true },
							{ type: 'rule', field: 'year', operator: 'gte', value: 2020 }
						]
					},
					{ type: 'rule', field: 'quality_profile', operator: 'eq', value: '4K' }
				]
			};
			assertEquals(evaluateGroup(item, group), true);
		});

		this.test('nested groups: deeply nested structure', () => {
			// Complex nested structure
			const item = {
				monitored: true,
				year: 2023,
				genres: 'Action, Thriller',
				tmdb_rating: 8.5
			};
			const group: FilterGroup = {
				type: 'group',
				match: 'all',
				children: [
					{ type: 'rule', field: 'monitored', operator: 'is', value: true },
					{
						type: 'group',
						match: 'any',
						children: [
							{
								type: 'group',
								match: 'all',
								children: [
									{ type: 'rule', field: 'year', operator: 'gte', value: 2020 },
									{ type: 'rule', field: 'genres', operator: 'contains', value: 'action' }
								]
							},
							{ type: 'rule', field: 'tmdb_rating', operator: 'gte', value: 9 }
						]
					}
				]
			};
			assertEquals(evaluateGroup(item, group), true);
		});

		// =====================
		// Real-world Scenarios
		// =====================

		this.test('scenario: find unmonitored movies from 2020+', () => {
			const movies = [
				{ title: 'Movie 1', monitored: true, year: 2023 },
				{ title: 'Movie 2', monitored: false, year: 2021 },
				{ title: 'Movie 3', monitored: false, year: 2019 },
				{ title: 'Movie 4', monitored: false, year: 2022 }
			];
			const group: FilterGroup = {
				type: 'group',
				match: 'all',
				children: [
					{ type: 'rule', field: 'monitored', operator: 'is', value: false },
					{ type: 'rule', field: 'year', operator: 'gte', value: 2020 }
				]
			};

			const matched = movies.filter((m) => evaluateGroup(m, group));
			assertEquals(matched.length, 2);
			assertEquals(matched[0].title, 'Movie 2');
			assertEquals(matched[1].title, 'Movie 4');
		});

		this.test('scenario: find high-rated action movies', () => {
			const movies = [
				{ title: 'Movie 1', genres: 'Action, Adventure', tmdb_rating: 8.5 },
				{ title: 'Movie 2', genres: 'Comedy', tmdb_rating: 9.0 },
				{ title: 'Movie 3', genres: 'Action, Thriller', tmdb_rating: 7.5 },
				{ title: 'Movie 4', genres: 'Action', tmdb_rating: 8.8 }
			];
			const group: FilterGroup = {
				type: 'group',
				match: 'all',
				children: [
					{ type: 'rule', field: 'genres', operator: 'contains', value: 'action' },
					{ type: 'rule', field: 'tmdb_rating', operator: 'gte', value: 8.0 }
				]
			};

			const matched = movies.filter((m) => evaluateGroup(m, group));
			assertEquals(matched.length, 2);
			assertEquals(matched[0].title, 'Movie 1');
			assertEquals(matched[1].title, 'Movie 4');
		});

		this.test('scenario: find movies where cutoff not met', () => {
			const movies = [
				{ title: 'Movie 1', cutoff_met: true, monitored: true },
				{ title: 'Movie 2', cutoff_met: false, monitored: true },
				{ title: 'Movie 3', cutoff_met: false, monitored: false },
				{ title: 'Movie 4', cutoff_met: false, monitored: true }
			];
			const group: FilterGroup = {
				type: 'group',
				match: 'all',
				children: [
					{ type: 'rule', field: 'cutoff_met', operator: 'is', value: false },
					{ type: 'rule', field: 'monitored', operator: 'is', value: true }
				]
			};

			const matched = movies.filter((m) => evaluateGroup(m, group));
			assertEquals(matched.length, 2);
			assertEquals(matched[0].title, 'Movie 2');
			assertEquals(matched[1].title, 'Movie 4');
		});
	}
}

// Create instance and run tests
const filterTest = new FilterEvaluationTest();
filterTest.runTests();
