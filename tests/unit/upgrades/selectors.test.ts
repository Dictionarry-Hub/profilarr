/**
 * Tests for selector logic
 * Tests all selectors from shared/selectors.ts
 */

import { BaseTest } from '../base/BaseTest.ts';
import { assertEquals, assert } from '@std/assert';
import {
	selectors,
	getSelector,
	isValidSelector,
	getAllSelectorIds
} from '../../../src/lib/shared/upgrades/selectors.ts';

interface MockItem {
	id: number;
	title: string;
	dateAdded: string;
	score: number;
	popularity: number;
}

class SelectorsTest extends BaseTest {
	private createMockItems(): MockItem[] {
		return [
			{
				id: 1,
				title: 'Movie A',
				dateAdded: '2023-01-15T00:00:00Z',
				score: 50,
				popularity: 100
			},
			{
				id: 2,
				title: 'Movie B',
				dateAdded: '2023-06-20T00:00:00Z',
				score: 75,
				popularity: 200
			},
			{
				id: 3,
				title: 'Movie C',
				dateAdded: '2022-03-10T00:00:00Z',
				score: 25,
				popularity: 150
			},
			{
				id: 4,
				title: 'Movie D',
				dateAdded: '2024-01-01T00:00:00Z',
				score: 100,
				popularity: 50
			},
			{
				id: 5,
				title: 'Movie E',
				dateAdded: '2023-09-05T00:00:00Z',
				score: 60,
				popularity: 300
			}
		];
	}

	runTests(): void {
		// =====================
		// Helper Function Tests
		// =====================

		this.test('getSelector returns correct selector', () => {
			const selector = getSelector('random');
			assertEquals(selector?.id, 'random');
			assertEquals(selector?.label, 'Random');
		});

		this.test('getSelector returns undefined for invalid id', () => {
			const selector = getSelector('nonexistent');
			assertEquals(selector, undefined);
		});

		this.test('isValidSelector returns true for valid ids', () => {
			assertEquals(isValidSelector('random'), true);
			assertEquals(isValidSelector('oldest'), true);
			assertEquals(isValidSelector('newest'), true);
			assertEquals(isValidSelector('lowest_score'), true);
			assertEquals(isValidSelector('most_popular'), true);
			assertEquals(isValidSelector('least_popular'), true);
		});

		this.test('isValidSelector returns false for invalid ids', () => {
			assertEquals(isValidSelector('nonexistent'), false);
			assertEquals(isValidSelector(''), false);
		});

		this.test('getAllSelectorIds returns all selector ids', () => {
			const ids = getAllSelectorIds();
			assertEquals(ids.length, 8);
			assert(ids.includes('random'));
			assert(ids.includes('oldest'));
			assert(ids.includes('newest'));
			assert(ids.includes('lowest_score'));
			assert(ids.includes('most_popular'));
			assert(ids.includes('least_popular'));
			assert(ids.includes('alphabetical_asc'));
			assert(ids.includes('alphabetical_desc'));
		});

		// =====================
		// Random Selector
		// =====================

		this.test('random: selects correct count', () => {
			const items = this.createMockItems();
			const selector = getSelector('random')!;
			const selected = selector.select(items, 3);
			assertEquals(selected.length, 3);
		});

		this.test('random: handles count larger than items', () => {
			const items = this.createMockItems();
			const selector = getSelector('random')!;
			const selected = selector.select(items, 10);
			assertEquals(selected.length, 5); // Only 5 items available
		});

		this.test('random: returns empty array for empty input', () => {
			const selector = getSelector('random')!;
			const selected = selector.select([], 5);
			assertEquals(selected.length, 0);
		});

		this.test('random: does not modify original array', () => {
			const items = this.createMockItems();
			const originalFirst = items[0];
			const selector = getSelector('random')!;
			selector.select(items, 3);
			assertEquals(items[0], originalFirst);
			assertEquals(items.length, 5);
		});

		// =====================
		// Oldest Selector
		// =====================

		this.test('oldest: selects oldest items first', () => {
			const items = this.createMockItems();
			const selector = getSelector('oldest')!;
			const selected = selector.select(items, 3);

			assertEquals(selected.length, 3);
			// Movie C (2022-03-10) is oldest
			assertEquals(selected[0].id, 3);
			assertEquals(selected[0].title, 'Movie C');
			// Movie A (2023-01-15) is second oldest
			assertEquals(selected[1].id, 1);
			// Movie B (2023-06-20) is third oldest
			assertEquals(selected[2].id, 2);
		});

		this.test('oldest: handles items with same date', () => {
			const items: MockItem[] = [
				{ id: 1, title: 'A', dateAdded: '2023-01-15T00:00:00Z', score: 0, popularity: 0 },
				{ id: 2, title: 'B', dateAdded: '2023-01-15T00:00:00Z', score: 0, popularity: 0 },
				{ id: 3, title: 'C', dateAdded: '2022-01-15T00:00:00Z', score: 0, popularity: 0 }
			];
			const selector = getSelector('oldest')!;
			const selected = selector.select(items, 2);

			assertEquals(selected.length, 2);
			assertEquals(selected[0].id, 3); // Oldest first
		});

		this.test('oldest: handles missing dateAdded', () => {
			const items = [
				{ id: 1, title: 'A', score: 0, popularity: 0 },
				{ id: 2, title: 'B', dateAdded: '2023-01-15T00:00:00Z', score: 0, popularity: 0 }
			] as MockItem[];
			const selector = getSelector('oldest')!;
			const selected = selector.select(items, 2);

			assertEquals(selected.length, 2);
			// Item without dateAdded should be treated as epoch (very old)
			assertEquals(selected[0].id, 1);
		});

		// =====================
		// Newest Selector
		// =====================

		this.test('newest: selects newest items first', () => {
			const items = this.createMockItems();
			const selector = getSelector('newest')!;
			const selected = selector.select(items, 3);

			assertEquals(selected.length, 3);
			// Movie D (2024-01-01) is newest
			assertEquals(selected[0].id, 4);
			assertEquals(selected[0].title, 'Movie D');
			// Movie E (2023-09-05) is second newest
			assertEquals(selected[1].id, 5);
			// Movie B (2023-06-20) is third newest
			assertEquals(selected[2].id, 2);
		});

		this.test('newest: handles count of 1', () => {
			const items = this.createMockItems();
			const selector = getSelector('newest')!;
			const selected = selector.select(items, 1);

			assertEquals(selected.length, 1);
			assertEquals(selected[0].id, 4); // Movie D is newest
		});

		// =====================
		// Lowest Score Selector
		// =====================

		this.test('lowest_score: selects items with lowest score first', () => {
			const items = this.createMockItems();
			const selector = getSelector('lowest_score')!;
			const selected = selector.select(items, 3);

			assertEquals(selected.length, 3);
			// Movie C (score: 25) has lowest score
			assertEquals(selected[0].id, 3);
			assertEquals(selected[0].score, 25);
			// Movie A (score: 50) has second lowest
			assertEquals(selected[1].id, 1);
			assertEquals(selected[1].score, 50);
			// Movie E (score: 60) has third lowest
			assertEquals(selected[2].id, 5);
			assertEquals(selected[2].score, 60);
		});

		this.test('lowest_score: handles zero scores', () => {
			const items: MockItem[] = [
				{ id: 1, title: 'A', dateAdded: '', score: 0, popularity: 0 },
				{ id: 2, title: 'B', dateAdded: '', score: 50, popularity: 0 },
				{ id: 3, title: 'C', dateAdded: '', score: -10, popularity: 0 } // Negative score
			];
			const selector = getSelector('lowest_score')!;
			const selected = selector.select(items, 2);

			assertEquals(selected.length, 2);
			assertEquals(selected[0].id, 3); // Negative is lowest
			assertEquals(selected[1].id, 1); // Zero is next
		});

		this.test('lowest_score: handles missing score', () => {
			const items = [
				{ id: 1, title: 'A', dateAdded: '', popularity: 0 },
				{ id: 2, title: 'B', dateAdded: '', score: 50, popularity: 0 }
			] as MockItem[];
			const selector = getSelector('lowest_score')!;
			const selected = selector.select(items, 2);

			assertEquals(selected.length, 2);
			// Item without score (treated as 0) should be first
			assertEquals(selected[0].id, 1);
		});

		// =====================
		// Most Popular Selector
		// =====================

		this.test('most_popular: selects most popular items first', () => {
			const items = this.createMockItems();
			const selector = getSelector('most_popular')!;
			const selected = selector.select(items, 3);

			assertEquals(selected.length, 3);
			// Movie E (popularity: 300) is most popular
			assertEquals(selected[0].id, 5);
			assertEquals(selected[0].popularity, 300);
			// Movie B (popularity: 200) is second
			assertEquals(selected[1].id, 2);
			assertEquals(selected[1].popularity, 200);
			// Movie C (popularity: 150) is third
			assertEquals(selected[2].id, 3);
			assertEquals(selected[2].popularity, 150);
		});

		this.test('most_popular: handles same popularity', () => {
			const items: MockItem[] = [
				{ id: 1, title: 'A', dateAdded: '', score: 0, popularity: 100 },
				{ id: 2, title: 'B', dateAdded: '', score: 0, popularity: 100 },
				{ id: 3, title: 'C', dateAdded: '', score: 0, popularity: 200 }
			];
			const selector = getSelector('most_popular')!;
			const selected = selector.select(items, 2);

			assertEquals(selected.length, 2);
			assertEquals(selected[0].id, 3); // Most popular first
		});

		// =====================
		// Least Popular Selector
		// =====================

		this.test('least_popular: selects least popular items first', () => {
			const items = this.createMockItems();
			const selector = getSelector('least_popular')!;
			const selected = selector.select(items, 3);

			assertEquals(selected.length, 3);
			// Movie D (popularity: 50) is least popular
			assertEquals(selected[0].id, 4);
			assertEquals(selected[0].popularity, 50);
			// Movie A (popularity: 100) is second least
			assertEquals(selected[1].id, 1);
			assertEquals(selected[1].popularity, 100);
			// Movie C (popularity: 150) is third least
			assertEquals(selected[2].id, 3);
			assertEquals(selected[2].popularity, 150);
		});

		this.test('least_popular: handles missing popularity', () => {
			const items = [
				{ id: 1, title: 'A', dateAdded: '', score: 0 },
				{ id: 2, title: 'B', dateAdded: '', score: 0, popularity: 100 }
			] as MockItem[];
			const selector = getSelector('least_popular')!;
			const selected = selector.select(items, 2);

			assertEquals(selected.length, 2);
			// Item without popularity (treated as 0) should be first (least popular)
			assertEquals(selected[0].id, 1);
		});

		// =====================
		// Edge Cases
		// =====================

		this.test('edge case: count of 0 returns empty array', () => {
			const items = this.createMockItems();
			for (const selector of selectors) {
				const selected = selector.select(items, 0);
				assertEquals(selected.length, 0, `${selector.id} should return empty array for count=0`);
			}
		});

		this.test('edge case: negative count returns empty array', () => {
			const items = this.createMockItems();
			for (const selector of selectors) {
				const selected = selector.select(items, -5);
				assertEquals(
					selected.length,
					0,
					`${selector.id} should return empty array for negative count`
				);
			}
		});

		this.test('edge case: single item', () => {
			const items: MockItem[] = [
				{ id: 1, title: 'Only One', dateAdded: '2023-01-15T00:00:00Z', score: 50, popularity: 100 }
			];

			for (const selector of selectors) {
				const selected = selector.select(items, 1);
				assertEquals(selected.length, 1, `${selector.id} should return 1 item`);
				assertEquals(selected[0].id, 1, `${selector.id} should return the only item`);
			}
		});

		// =====================
		// Integration Scenarios
		// =====================

		this.test('scenario: upgrade workflow with lowest score selector', () => {
			// Simulate items that passed filter evaluation
			const filteredItems: MockItem[] = [
				{
					id: 10,
					title: 'Needs Upgrade',
					dateAdded: '2023-01-01T00:00:00Z',
					score: 30,
					popularity: 100
				},
				{
					id: 20,
					title: 'Almost There',
					dateAdded: '2023-02-01T00:00:00Z',
					score: 70,
					popularity: 200
				},
				{
					id: 30,
					title: 'Very Low',
					dateAdded: '2023-03-01T00:00:00Z',
					score: 10,
					popularity: 150
				},
				{ id: 40, title: 'Medium', dateAdded: '2023-04-01T00:00:00Z', score: 50, popularity: 80 }
			];

			const selector = getSelector('lowest_score')!;
			const toUpgrade = selector.select(filteredItems, 2);

			assertEquals(toUpgrade.length, 2);
			// Should select the two with lowest scores for upgrade
			assertEquals(toUpgrade[0].id, 30); // score: 10
			assertEquals(toUpgrade[1].id, 10); // score: 30
		});

		this.test('scenario: upgrade workflow with oldest selector', () => {
			// Simulate prioritizing oldest items that need upgrade
			const filteredItems: MockItem[] = [
				{ id: 10, title: 'Recent', dateAdded: '2024-01-01T00:00:00Z', score: 30, popularity: 100 },
				{ id: 20, title: 'Old', dateAdded: '2020-01-01T00:00:00Z', score: 40, popularity: 200 },
				{ id: 30, title: 'Very Old', dateAdded: '2018-06-01T00:00:00Z', score: 50, popularity: 150 }
			];

			const selector = getSelector('oldest')!;
			const toUpgrade = selector.select(filteredItems, 2);

			assertEquals(toUpgrade.length, 2);
			assertEquals(toUpgrade[0].id, 30); // Very Old (2018)
			assertEquals(toUpgrade[1].id, 20); // Old (2020)
		});
	}
}

// Create instance and run tests
const selectorsTest = new SelectorsTest();
selectorsTest.runTests();
