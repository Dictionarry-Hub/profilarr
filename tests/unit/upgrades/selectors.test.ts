/**
 * Tests for selector logic
 * Tests all selectors from shared/selectors.ts
 */

import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { expect } from 'vitest';
import {
	selectors,
	getSelector,
	isValidSelector,
	getAllSelectorIds
} from '#shared/upgrades/selectors.ts';

interface MockItem {
	id: number;
	title: string;
	dateAdded: string;
	score: number;
	popularity: number;
	size_on_disk?: number;
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
			expect(selector?.id).toStrictEqual('random');
			expect(selector?.label).toStrictEqual('Random');
		});

		this.test('getSelector returns undefined for invalid id', () => {
			const selector = getSelector('nonexistent');
			expect(selector).toStrictEqual(undefined);
		});

		this.test('isValidSelector returns true for valid ids', () => {
			expect(isValidSelector('random')).toStrictEqual(true);
			expect(isValidSelector('oldest')).toStrictEqual(true);
			expect(isValidSelector('newest')).toStrictEqual(true);
			expect(isValidSelector('lowest_score')).toStrictEqual(true);
			expect(isValidSelector('size_desc')).toStrictEqual(true);
			expect(isValidSelector('size_asc')).toStrictEqual(true);
			expect(isValidSelector('most_popular')).toStrictEqual(true);
			expect(isValidSelector('least_popular')).toStrictEqual(true);
		});

		this.test('isValidSelector returns false for invalid ids', () => {
			expect(isValidSelector('nonexistent')).toStrictEqual(false);
			expect(isValidSelector('')).toStrictEqual(false);
		});

		this.test('getAllSelectorIds returns all selector ids', () => {
			const ids = getAllSelectorIds();
			expect(ids.length).toStrictEqual(10);
			expect(ids.includes('random')).toBeTruthy();
			expect(ids.includes('oldest')).toBeTruthy();
			expect(ids.includes('newest')).toBeTruthy();
			expect(ids.includes('lowest_score')).toBeTruthy();
			expect(ids.includes('size_desc')).toBeTruthy();
			expect(ids.includes('size_asc')).toBeTruthy();
			expect(ids.includes('most_popular')).toBeTruthy();
			expect(ids.includes('least_popular')).toBeTruthy();
			expect(ids.includes('alphabetical_asc')).toBeTruthy();
			expect(ids.includes('alphabetical_desc')).toBeTruthy();
		});

		// =====================
		// Size Selectors
		// =====================

		this.test('size_desc: selects largest positive sizes first', () => {
			const items: MockItem[] = [
				{ id: 1, title: 'A', dateAdded: '', score: 0, popularity: 0, size_on_disk: 8 },
				{ id: 2, title: 'B', dateAdded: '', score: 0, popularity: 0, size_on_disk: 12 },
				{ id: 3, title: 'C', dateAdded: '', score: 0, popularity: 0, size_on_disk: 3 },
				{ id: 4, title: 'Zero', dateAdded: '', score: 0, popularity: 0, size_on_disk: 0 },
				{ id: 5, title: 'Missing', dateAdded: '', score: 0, popularity: 0 },
				{ id: 6, title: 'Invalid', dateAdded: '', score: 0, popularity: 0, size_on_disk: NaN }
			];
			const originalOrder = items.map((item) => item.id);
			const selector = getSelector('size_desc')!;
			const selected = selector.select(items, 10);
			const limited = selector.select(items, 2);

			expect(selected.map((item) => item.id)).toStrictEqual([2, 1, 3, 4, 5, 6]);
			expect(limited.map((item) => item.id)).toStrictEqual([2, 1]);
			expect(items.map((item) => item.id)).toStrictEqual(originalOrder);
		});

		this.test('size_asc: selects smallest positive sizes and puts unusable sizes last', () => {
			const items: MockItem[] = [
				{ id: 1, title: 'Zero', dateAdded: '', score: 0, popularity: 0, size_on_disk: 0 },
				{ id: 2, title: 'Eight', dateAdded: '', score: 0, popularity: 0, size_on_disk: 8 },
				{ id: 3, title: 'Missing', dateAdded: '', score: 0, popularity: 0 },
				{ id: 4, title: 'Three', dateAdded: '', score: 0, popularity: 0, size_on_disk: 3 },
				{ id: 5, title: 'Invalid', dateAdded: '', score: 0, popularity: 0, size_on_disk: NaN }
			];
			const selected = getSelector('size_asc')!.select(items, 10);

			expect(selected.map((item) => item.id)).toStrictEqual([4, 2, 1, 3, 5]);
		});

		// =====================
		// Random Selector
		// =====================

		this.test('random: selects correct count', () => {
			const items = this.createMockItems();
			const selector = getSelector('random')!;
			const selected = selector.select(items, 3);
			expect(selected.length).toStrictEqual(3);
		});

		this.test('random: handles count larger than items', () => {
			const items = this.createMockItems();
			const selector = getSelector('random')!;
			const selected = selector.select(items, 10);
			expect(selected.length).toStrictEqual(5); // Only 5 items available
		});

		this.test('random: returns empty array for empty input', () => {
			const selector = getSelector('random')!;
			const selected = selector.select([], 5);
			expect(selected.length).toStrictEqual(0);
		});

		this.test('random: does not modify original array', () => {
			const items = this.createMockItems();
			const originalFirst = items[0];
			const selector = getSelector('random')!;
			selector.select(items, 3);
			expect(items[0]).toStrictEqual(originalFirst);
			expect(items.length).toStrictEqual(5);
		});

		// =====================
		// Oldest Selector
		// =====================

		this.test('oldest: selects oldest items first', () => {
			const items = this.createMockItems();
			const selector = getSelector('oldest')!;
			const selected = selector.select(items, 3);

			expect(selected.length).toStrictEqual(3);
			// Movie C (2022-03-10) is oldest
			expect(selected[0].id).toStrictEqual(3);
			expect(selected[0].title).toStrictEqual('Movie C');
			// Movie A (2023-01-15) is second oldest
			expect(selected[1].id).toStrictEqual(1);
			// Movie B (2023-06-20) is third oldest
			expect(selected[2].id).toStrictEqual(2);
		});

		this.test('oldest: handles items with same date', () => {
			const items: MockItem[] = [
				{ id: 1, title: 'A', dateAdded: '2023-01-15T00:00:00Z', score: 0, popularity: 0 },
				{ id: 2, title: 'B', dateAdded: '2023-01-15T00:00:00Z', score: 0, popularity: 0 },
				{ id: 3, title: 'C', dateAdded: '2022-01-15T00:00:00Z', score: 0, popularity: 0 }
			];
			const selector = getSelector('oldest')!;
			const selected = selector.select(items, 2);

			expect(selected.length).toStrictEqual(2);
			expect(selected[0].id).toStrictEqual(3); // Oldest first
		});

		this.test('oldest: handles missing dateAdded', () => {
			const items = [
				{ id: 1, title: 'A', score: 0, popularity: 0 },
				{ id: 2, title: 'B', dateAdded: '2023-01-15T00:00:00Z', score: 0, popularity: 0 }
			] as MockItem[];
			const selector = getSelector('oldest')!;
			const selected = selector.select(items, 2);

			expect(selected.length).toStrictEqual(2);
			// Item without dateAdded should be treated as epoch (very old)
			expect(selected[0].id).toStrictEqual(1);
		});

		// =====================
		// Newest Selector
		// =====================

		this.test('newest: selects newest items first', () => {
			const items = this.createMockItems();
			const selector = getSelector('newest')!;
			const selected = selector.select(items, 3);

			expect(selected.length).toStrictEqual(3);
			// Movie D (2024-01-01) is newest
			expect(selected[0].id).toStrictEqual(4);
			expect(selected[0].title).toStrictEqual('Movie D');
			// Movie E (2023-09-05) is second newest
			expect(selected[1].id).toStrictEqual(5);
			// Movie B (2023-06-20) is third newest
			expect(selected[2].id).toStrictEqual(2);
		});

		this.test('newest: handles count of 1', () => {
			const items = this.createMockItems();
			const selector = getSelector('newest')!;
			const selected = selector.select(items, 1);

			expect(selected.length).toStrictEqual(1);
			expect(selected[0].id).toStrictEqual(4); // Movie D is newest
		});

		// =====================
		// Lowest Score Selector
		// =====================

		this.test('lowest_score: selects items with lowest score first', () => {
			const items = this.createMockItems();
			const selector = getSelector('lowest_score')!;
			const selected = selector.select(items, 3);

			expect(selected.length).toStrictEqual(3);
			// Movie C (score: 25) has lowest score
			expect(selected[0].id).toStrictEqual(3);
			expect(selected[0].score).toStrictEqual(25);
			// Movie A (score: 50) has second lowest
			expect(selected[1].id).toStrictEqual(1);
			expect(selected[1].score).toStrictEqual(50);
			// Movie E (score: 60) has third lowest
			expect(selected[2].id).toStrictEqual(5);
			expect(selected[2].score).toStrictEqual(60);
		});

		this.test('lowest_score: handles zero scores', () => {
			const items: MockItem[] = [
				{ id: 1, title: 'A', dateAdded: '', score: 0, popularity: 0 },
				{ id: 2, title: 'B', dateAdded: '', score: 50, popularity: 0 },
				{ id: 3, title: 'C', dateAdded: '', score: -10, popularity: 0 } // Negative score
			];
			const selector = getSelector('lowest_score')!;
			const selected = selector.select(items, 2);

			expect(selected.length).toStrictEqual(2);
			expect(selected[0].id).toStrictEqual(3); // Negative is lowest
			expect(selected[1].id).toStrictEqual(1); // Zero is next
		});

		this.test('lowest_score: handles missing score', () => {
			const items = [
				{ id: 1, title: 'A', dateAdded: '', popularity: 0 },
				{ id: 2, title: 'B', dateAdded: '', score: 50, popularity: 0 }
			] as MockItem[];
			const selector = getSelector('lowest_score')!;
			const selected = selector.select(items, 2);

			expect(selected.length).toStrictEqual(2);
			// Item without score (treated as 0) should be first
			expect(selected[0].id).toStrictEqual(1);
		});

		// =====================
		// Most Popular Selector
		// =====================

		this.test('most_popular: selects most popular items first', () => {
			const items = this.createMockItems();
			const selector = getSelector('most_popular')!;
			const selected = selector.select(items, 3);

			expect(selected.length).toStrictEqual(3);
			// Movie E (popularity: 300) is most popular
			expect(selected[0].id).toStrictEqual(5);
			expect(selected[0].popularity).toStrictEqual(300);
			// Movie B (popularity: 200) is second
			expect(selected[1].id).toStrictEqual(2);
			expect(selected[1].popularity).toStrictEqual(200);
			// Movie C (popularity: 150) is third
			expect(selected[2].id).toStrictEqual(3);
			expect(selected[2].popularity).toStrictEqual(150);
		});

		this.test('most_popular: handles same popularity', () => {
			const items: MockItem[] = [
				{ id: 1, title: 'A', dateAdded: '', score: 0, popularity: 100 },
				{ id: 2, title: 'B', dateAdded: '', score: 0, popularity: 100 },
				{ id: 3, title: 'C', dateAdded: '', score: 0, popularity: 200 }
			];
			const selector = getSelector('most_popular')!;
			const selected = selector.select(items, 2);

			expect(selected.length).toStrictEqual(2);
			expect(selected[0].id).toStrictEqual(3); // Most popular first
		});

		// =====================
		// Least Popular Selector
		// =====================

		this.test('least_popular: selects least popular items first', () => {
			const items = this.createMockItems();
			const selector = getSelector('least_popular')!;
			const selected = selector.select(items, 3);

			expect(selected.length).toStrictEqual(3);
			// Movie D (popularity: 50) is least popular
			expect(selected[0].id).toStrictEqual(4);
			expect(selected[0].popularity).toStrictEqual(50);
			// Movie A (popularity: 100) is second least
			expect(selected[1].id).toStrictEqual(1);
			expect(selected[1].popularity).toStrictEqual(100);
			// Movie C (popularity: 150) is third least
			expect(selected[2].id).toStrictEqual(3);
			expect(selected[2].popularity).toStrictEqual(150);
		});

		this.test('least_popular: handles missing popularity', () => {
			const items = [
				{ id: 1, title: 'A', dateAdded: '', score: 0 },
				{ id: 2, title: 'B', dateAdded: '', score: 0, popularity: 100 }
			] as MockItem[];
			const selector = getSelector('least_popular')!;
			const selected = selector.select(items, 2);

			expect(selected.length).toStrictEqual(2);
			// Item without popularity (treated as 0) should be first (least popular)
			expect(selected[0].id).toStrictEqual(1);
		});

		// =====================
		// Edge Cases
		// =====================

		this.test('edge case: count of 0 returns empty array', () => {
			const items = this.createMockItems();
			for (const selector of selectors) {
				const selected = selector.select(items, 0);
				expect(
					selected.length,
					`${selector.id} should return empty array for count=0`
				).toStrictEqual(0);
			}
		});

		this.test('edge case: negative count returns empty array', () => {
			const items = this.createMockItems();
			for (const selector of selectors) {
				const selected = selector.select(items, -5);
				expect(
					selected.length,
					`${selector.id} should return empty array for negative count`
				).toStrictEqual(0);
			}
		});

		this.test('edge case: single item', () => {
			const items: MockItem[] = [
				{ id: 1, title: 'Only One', dateAdded: '2023-01-15T00:00:00Z', score: 50, popularity: 100 }
			];

			for (const selector of selectors) {
				const selected = selector.select(items, 1);
				expect(selected.length, `${selector.id} should return 1 item`).toStrictEqual(1);
				expect(selected[0].id, `${selector.id} should return the only item`).toStrictEqual(1);
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

			expect(toUpgrade.length).toStrictEqual(2);
			// Should select the two with lowest scores for upgrade
			expect(toUpgrade[0].id).toStrictEqual(30); // score: 10
			expect(toUpgrade[1].id).toStrictEqual(10); // score: 30
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

			expect(toUpgrade.length).toStrictEqual(2);
			expect(toUpgrade[0].id).toStrictEqual(30); // Very Old (2018)
			expect(toUpgrade[1].id).toStrictEqual(20); // Old (2020)
		});
	}
}

// Create instance and run tests
const selectorsTest = new SelectorsTest();
selectorsTest.runTests();
