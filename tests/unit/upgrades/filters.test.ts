/**
 * Tests for filter evaluation logic
 * Tests evaluateRule() and evaluateGroup() from shared/filters.ts
 */

import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { expect } from 'vitest';
import {
	evaluateRule,
	evaluateGroup,
	getDynamicFilterFieldIds,
	getFilterFields,
	filterGroupUsesField,
	normalizeFilterGroup,
	type FilterRule,
	type FilterGroup
} from '#shared/upgrades/filters.ts';

class FilterEvaluationTest extends BaseTest {
	runTests(): void {
		this.test('field usage detects rules in nested groups', () => {
			const group: FilterGroup = {
				type: 'group',
				match: 'all',
				children: [
					{ type: 'rule', field: 'monitored', operator: 'is', value: true },
					{
						type: 'group',
						match: 'any',
						children: [{ type: 'rule', field: 'cutoff_met', operator: 'is', value: false }]
					}
				]
			};

			expect(filterGroupUsesField(group, 'cutoff_met')).toStrictEqual(true);
			expect(filterGroupUsesField(group, 'year')).toStrictEqual(false);
		});

		// =====================
		// Boolean Operators
		// =====================

		this.test('boolean: is operator matches true', () => {
			const item = { monitored: true };
			const rule: FilterRule = { type: 'rule', field: 'monitored', operator: 'is', value: true };
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('boolean: is operator rejects false', () => {
			const item = { monitored: false };
			const rule: FilterRule = { type: 'rule', field: 'monitored', operator: 'is', value: true };
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('boolean: is_not operator matches', () => {
			const item = { monitored: false };
			const rule: FilterRule = {
				type: 'rule',
				field: 'monitored',
				operator: 'is_not',
				value: true
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('boolean: is_not operator rejects', () => {
			const item = { monitored: true };
			const rule: FilterRule = {
				type: 'rule',
				field: 'monitored',
				operator: 'is_not',
				value: true
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		// =====================
		// Number Operators
		// =====================

		this.test('number: eq operator matches', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'eq', value: 2023 };
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('number: eq operator rejects', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'eq', value: 2024 };
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('number: neq operator matches', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'neq', value: 2024 };
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('number: neq operator rejects', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'neq', value: 2023 };
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('number: gt operator matches', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'gt', value: 2020 };
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('number: gt operator rejects equal value', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'gt', value: 2023 };
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('number: gte operator matches equal value', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'gte', value: 2023 };
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('number: gte operator matches greater value', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'gte', value: 2020 };
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('number: lt operator matches', () => {
			const item = { year: 2020 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'lt', value: 2023 };
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('number: lt operator rejects equal value', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'lt', value: 2023 };
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('number: lte operator matches equal value', () => {
			const item = { year: 2023 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'lte', value: 2023 };
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('number: lte operator matches less value', () => {
			const item = { year: 2020 };
			const rule: FilterRule = { type: 'rule', field: 'year', operator: 'lte', value: 2023 };
			expect(evaluateRule(item, rule)).toStrictEqual(true);
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
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('text: contains operator rejects', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'contains',
				value: 'batman'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('text: not_contains operator matches', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'not_contains',
				value: 'batman'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('text: not_contains operator rejects', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'not_contains',
				value: 'dark'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('text: starts_with operator matches (case insensitive)', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'starts_with',
				value: 'the'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('text: starts_with operator rejects', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'starts_with',
				value: 'dark'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('text: ends_with operator matches (case insensitive)', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'ends_with',
				value: 'KNIGHT'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('text: ends_with operator rejects', () => {
			const item = { title: 'The Dark Knight' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'ends_with',
				value: 'dark'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('text: eq operator matches (case insensitive)', () => {
			const item = { quality_profile: 'HD-1080p' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'quality_profile',
				operator: 'eq',
				value: 'hd-1080p'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('text: neq operator matches (case insensitive)', () => {
			const item = { quality_profile: 'HD-1080p' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'quality_profile',
				operator: 'neq',
				value: '4K'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		// =====================
		// Multi-Value Operators
		// =====================

		this.test('tags: includes matches exact tag in multi-tag list', () => {
			const item = { tags: ['no-redownload', 'profilarr-upgrades'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'tags',
				operator: 'includes',
				value: 'no-redownload'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('tags: does_not_include rejects exact tag in multi-tag list', () => {
			const item = { tags: ['no-redownload', 'profilarr-upgrades'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'tags',
				operator: 'does_not_include',
				value: 'no-redownload'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('tags: has_any matches non-empty tag list', () => {
			const item = { tags: ['no-redownload'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'tags',
				operator: 'has_any',
				value: null
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('tags: is_only matches single selected tag', () => {
			const item = { tags: ['no-redownload'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'tags',
				operator: 'is_only',
				value: 'no-redownload'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('tags: is_only rejects selected tag with other tags', () => {
			const item = { tags: ['no-redownload', 'profilarr-upgrades'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'tags',
				operator: 'is_only',
				value: 'no-redownload'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('tags: has_none matches empty tag list', () => {
			const item = { tags: [] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'tags',
				operator: 'has_none',
				value: null
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('tags: legacy eq matches exact tag in multi-tag list', () => {
			const item = { tags: ['no-redownload', 'profilarr-upgrades'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'tags',
				operator: 'eq',
				value: 'no-redownload'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('tags: legacy neq rejects exact tag in multi-tag list', () => {
			const item = { tags: ['no-redownload', 'profilarr-upgrades'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'tags',
				operator: 'neq',
				value: 'no-redownload'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('genres: includes matches exact genre in multi-genre list', () => {
			const item = { genres: ['Comedy', 'Fantasy'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'genres',
				operator: 'includes',
				value: 'fantasy'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('genres: legacy neq rejects exact genre in multi-genre list', () => {
			const item = { genres: ['Comedy', 'Fantasy'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'genres',
				operator: 'neq',
				value: 'Fantasy'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('multi-value normalize: maps legacy tag and genre operators', () => {
			const group: FilterGroup = {
				type: 'group',
				match: 'all',
				children: [
					{ type: 'rule', field: 'tags', operator: 'eq', value: 'no-redownload' },
					{ type: 'rule', field: 'tags', operator: 'neq', value: 'manual-review' },
					{ type: 'rule', field: 'genres', operator: 'eq', value: 'Action' },
					{ type: 'rule', field: 'genres', operator: 'neq', value: 'Comedy' }
				]
			};

			expect(normalizeFilterGroup(group, 'radarr')).toStrictEqual(true);
			const rules = group.children as FilterRule[];
			expect(rules[0].operator).toStrictEqual('includes');
			expect(rules[1].operator).toStrictEqual('does_not_include');
			expect(rules[2].operator).toStrictEqual('includes');
			expect(rules[3].operator).toStrictEqual('does_not_include');
		});

		this.test('multi-value normalize: clears values for unary operators', () => {
			const group: FilterGroup = {
				type: 'group',
				match: 'all',
				children: [{ type: 'rule', field: 'tags', operator: 'has_any', value: 'unused' }]
			};

			expect(normalizeFilterGroup(group, 'radarr')).toStrictEqual(true);
			const rule = group.children[0] as FilterRule;
			expect(rule.value).toStrictEqual(null);
		});

		// =====================
		// Custom Format Operators
		// =====================

		this.test('custom format: includes matches present format', () => {
			const item = { custom_formats: ['Tier 6', 'HDR10'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'custom_format',
				operator: 'includes',
				value: 'Tier 6'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('custom format: includes rejects absent format', () => {
			const item = { custom_formats: ['Tier 5', 'HDR10'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'custom_format',
				operator: 'includes',
				value: 'Tier 6'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('custom format: does_not_include matches absent format', () => {
			const item = { custom_formats: ['Tier 5', 'HDR10'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'custom_format',
				operator: 'does_not_include',
				value: 'Tier 6'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('custom format: does_not_include rejects present format', () => {
			const item = { custom_formats: ['Tier 6', 'HDR10'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'custom_format',
				operator: 'does_not_include',
				value: 'Tier 6'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('custom format: is_only matches single selected format', () => {
			const item = { custom_formats: ['Tier 6'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'custom_format',
				operator: 'is_only',
				value: 'Tier 6'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('custom format: is_only rejects selected format with other formats', () => {
			const item = { custom_formats: ['Tier 6', 'HDR10'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'custom_format',
				operator: 'is_only',
				value: 'Tier 6'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('custom format: has_any matches non-empty formats', () => {
			const item = { custom_formats: ['Tier 6'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'custom_format',
				operator: 'has_any',
				value: null
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('custom format: has_any rejects empty formats', () => {
			const item = { custom_formats: [] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'custom_format',
				operator: 'has_any',
				value: null
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('custom format: has_none matches empty formats', () => {
			const item = { custom_formats: [] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'custom_format',
				operator: 'has_none',
				value: null
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('custom format: has_none rejects non-empty formats', () => {
			const item = { custom_formats: ['Tier 6'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'custom_format',
				operator: 'has_none',
				value: null
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('custom format: matching is case-insensitive', () => {
			const item = { custom_formats: ['Tier 6'] };
			const rule: FilterRule = {
				type: 'rule',
				field: 'custom_format',
				operator: 'includes',
				value: 'tier 6'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('custom format: field is Radarr-only', () => {
			expect(getFilterFields('radarr').some((field) => field.id === 'custom_format')).toStrictEqual(
				true
			);
			expect(getFilterFields('sonarr').some((field) => field.id === 'custom_format')).toStrictEqual(
				false
			);
		});

		this.test('custom format: field is Radarr dynamic', () => {
			expect(getDynamicFilterFieldIds('radarr').includes('custom_format')).toStrictEqual(true);
			expect(getDynamicFilterFieldIds('sonarr').includes('custom_format')).toStrictEqual(false);
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
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('date: before operator rejects', () => {
			const item = { date_added: '2023-06-15T00:00:00Z' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'date_added',
				operator: 'before',
				value: '2023-06-01T00:00:00Z'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('date: after operator matches', () => {
			const item = { date_added: '2023-06-15T00:00:00Z' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'date_added',
				operator: 'after',
				value: '2023-06-01T00:00:00Z'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('date: after operator rejects', () => {
			const item = { date_added: '2023-01-15T00:00:00Z' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'date_added',
				operator: 'after',
				value: '2023-06-01T00:00:00Z'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
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
			expect(evaluateRule(item, rule)).toStrictEqual(true);
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
			expect(evaluateRule(item, rule)).toStrictEqual(false);
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
			expect(evaluateRule(item, rule)).toStrictEqual(true);
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
			expect(evaluateRule(item, rule)).toStrictEqual(false);
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
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('ordinal: eq operator rejects different value', () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'eq',
				value: 'released'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('ordinal: neq operator matches different value', () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'neq',
				value: 'released'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('ordinal: neq operator rejects same value', () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'neq',
				value: 'inCinemas'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('ordinal: gte (has reached) matches same stage', () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'gte',
				value: 'inCinemas'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('ordinal: gte (has reached) matches later stage', () => {
			const item = { minimum_availability: 'released' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'gte',
				value: 'inCinemas'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('ordinal: gte (has reached) rejects earlier stage', () => {
			const item = { minimum_availability: 'announced' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'gte',
				value: 'inCinemas'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test("ordinal: lte (hasn't passed) matches same stage", () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'lte',
				value: 'inCinemas'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test("ordinal: lte (hasn't passed) matches earlier stage", () => {
			const item = { minimum_availability: 'announced' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'lte',
				value: 'inCinemas'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test("ordinal: lte (hasn't passed) rejects later stage", () => {
			const item = { minimum_availability: 'released' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'lte',
				value: 'inCinemas'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('ordinal: gt (is past) matches later stage', () => {
			const item = { minimum_availability: 'released' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'gt',
				value: 'inCinemas'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('ordinal: gt (is past) rejects same stage', () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'gt',
				value: 'inCinemas'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('ordinal: gt (is past) rejects earlier stage', () => {
			const item = { minimum_availability: 'announced' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'gt',
				value: 'inCinemas'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('ordinal: lt (is before) matches earlier stage', () => {
			const item = { minimum_availability: 'announced' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'lt',
				value: 'inCinemas'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('ordinal: lt (is before) rejects same stage', () => {
			const item = { minimum_availability: 'inCinemas' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'lt',
				value: 'inCinemas'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('ordinal: lt (is before) rejects later stage', () => {
			const item = { minimum_availability: 'released' };
			const rule: FilterRule = {
				type: 'rule',
				field: 'minimum_availability',
				operator: 'lt',
				value: 'inCinemas'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('ordinal: full hierarchy test - tba is earliest', () => {
			const item = { minimum_availability: 'tba' };
			// tba should be before all others
			expect(
				evaluateRule(item, {
					type: 'rule',
					field: 'minimum_availability',
					operator: 'lt',
					value: 'announced'
				})
			).toStrictEqual(true);
			expect(
				evaluateRule(item, {
					type: 'rule',
					field: 'minimum_availability',
					operator: 'lt',
					value: 'inCinemas'
				})
			).toStrictEqual(true);
			expect(
				evaluateRule(item, {
					type: 'rule',
					field: 'minimum_availability',
					operator: 'lt',
					value: 'released'
				})
			).toStrictEqual(true);
		});

		this.test('ordinal: full hierarchy test - released is latest', () => {
			const item = { minimum_availability: 'released' };
			// released should be past all others
			expect(
				evaluateRule(item, {
					type: 'rule',
					field: 'minimum_availability',
					operator: 'gt',
					value: 'tba'
				})
			).toStrictEqual(true);
			expect(
				evaluateRule(item, {
					type: 'rule',
					field: 'minimum_availability',
					operator: 'gt',
					value: 'announced'
				})
			).toStrictEqual(true);
			expect(
				evaluateRule(item, {
					type: 'rule',
					field: 'minimum_availability',
					operator: 'gt',
					value: 'inCinemas'
				})
			).toStrictEqual(true);
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
			expect(evaluateRule(item, rule)).toStrictEqual(false);
		});

		this.test('null field: is_not operator returns true', () => {
			const item = { title: null };
			const rule: FilterRule = {
				type: 'rule',
				field: 'title',
				operator: 'is_not',
				value: 'something'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('undefined field: neq operator returns true', () => {
			const item = { title: 'Test' }; // no 'genres' field
			const rule: FilterRule = {
				type: 'rule',
				field: 'genres',
				operator: 'neq',
				value: 'Action'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		this.test('undefined field: not_contains operator returns true', () => {
			const item = { title: 'Test' }; // no 'genres' field
			const rule: FilterRule = {
				type: 'rule',
				field: 'genres',
				operator: 'not_contains',
				value: 'Action'
			};
			expect(evaluateRule(item, rule)).toStrictEqual(true);
		});

		// =====================
		// Group Evaluation - AND Logic
		// =====================

		this.test('group: empty group matches all items', () => {
			const item = { title: 'Test', year: 2023 };
			const group: FilterGroup = { type: 'group', match: 'all', children: [] };
			expect(evaluateGroup(item, group)).toStrictEqual(true);
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
			expect(evaluateGroup(item, group)).toStrictEqual(true);
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
			expect(evaluateGroup(item, group)).toStrictEqual(false);
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
			expect(evaluateGroup(item, group)).toStrictEqual(true);
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
			expect(evaluateGroup(item, group)).toStrictEqual(false);
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
			expect(evaluateGroup(item, group)).toStrictEqual(true);
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
			expect(evaluateGroup(item, group)).toStrictEqual(true);
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
			expect(evaluateGroup(item, group)).toStrictEqual(true);
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
			expect(matched.length).toStrictEqual(2);
			expect(matched[0].title).toStrictEqual('Movie 2');
			expect(matched[1].title).toStrictEqual('Movie 4');
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
			expect(matched.length).toStrictEqual(2);
			expect(matched[0].title).toStrictEqual('Movie 1');
			expect(matched[1].title).toStrictEqual('Movie 4');
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
			expect(matched.length).toStrictEqual(2);
			expect(matched[0].title).toStrictEqual('Movie 2');
			expect(matched[1].title).toStrictEqual('Movie 4');
		});

		this.test('scenario: find monitored movies matching Tier 6', () => {
			const movies = [
				{ title: 'Movie 1', monitored: true, custom_formats: ['Tier 6'] },
				{ title: 'Movie 2', monitored: true, custom_formats: ['Tier 5'] },
				{ title: 'Movie 3', monitored: false, custom_formats: ['Tier 6'] },
				{ title: 'Movie 4', monitored: true, custom_formats: ['Tier 6', 'HDR10'] }
			];
			const group: FilterGroup = {
				type: 'group',
				match: 'all',
				children: [
					{ type: 'rule', field: 'monitored', operator: 'is', value: true },
					{ type: 'rule', field: 'custom_format', operator: 'includes', value: 'Tier 6' }
				]
			};

			const matched = movies.filter((m) => evaluateGroup(m, group));
			expect(matched.length).toStrictEqual(2);
			expect(matched[0].title).toStrictEqual('Movie 1');
			expect(matched[1].title).toStrictEqual('Movie 4');
		});
	}
}

// Create instance and run tests
const filterTest = new FilterEvaluationTest();
filterTest.runTests();
