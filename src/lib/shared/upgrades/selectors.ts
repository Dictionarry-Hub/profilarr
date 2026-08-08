/**
 * Shared selector types for both backend and frontend
 * Defines all available selectors for upgrade item selection
 */

import { sortTitle } from '$shared/utils/sort.ts';

// deno-lint-ignore no-explicit-any
export interface Selector<T = any> {
	id: string;
	label: string;
	description: string;
	select: (items: T[], count: number) => T[];
}

function compareSize(
	a: { size_on_disk?: unknown },
	b: { size_on_disk?: unknown },
	direction: 'asc' | 'desc'
): number {
	const sizeA =
		typeof a.size_on_disk === 'number' && Number.isFinite(a.size_on_disk) && a.size_on_disk > 0
			? a.size_on_disk
			: null;
	const sizeB =
		typeof b.size_on_disk === 'number' && Number.isFinite(b.size_on_disk) && b.size_on_disk > 0
			? b.size_on_disk
			: null;

	if (sizeA === null) return sizeB === null ? 0 : 1;
	if (sizeB === null) return -1;
	return direction === 'asc' ? sizeA - sizeB : sizeB - sizeA;
}

/**
 * All available selectors
 */
export const selectors: Selector[] = [
	{
		id: 'random',
		label: 'Random',
		description: 'Randomly select items',
		select: (items, count) => {
			const shuffled = [...items].sort(() => Math.random() - 0.5);
			return shuffled.slice(0, count);
		}
	},
	{
		id: 'oldest',
		label: 'Oldest',
		description: 'Select oldest items first (by date added)',
		select: (items, count) => {
			const sorted = [...items].sort((a, b) => {
				const dateA = new Date(a.dateAdded || 0).getTime();
				const dateB = new Date(b.dateAdded || 0).getTime();
				return dateA - dateB;
			});
			return sorted.slice(0, count);
		}
	},
	{
		id: 'newest',
		label: 'Newest',
		description: 'Select newest items first (by date added)',
		select: (items, count) => {
			const sorted = [...items].sort((a, b) => {
				const dateA = new Date(a.dateAdded || 0).getTime();
				const dateB = new Date(b.dateAdded || 0).getTime();
				return dateB - dateA;
			});
			return sorted.slice(0, count);
		}
	},
	{
		id: 'lowest_score',
		label: 'Lowest Score',
		description: 'Select items with lowest custom format score',
		select: (items, count) => {
			const sorted = [...items].sort((a, b) => (a.score || 0) - (b.score || 0));
			return sorted.slice(0, count);
		}
	},
	{
		id: 'size_desc',
		label: 'Size (Largest First)',
		description: 'Select items with the largest size on disk first',
		select: (items, count) => {
			const sorted = [...items].sort((a, b) => compareSize(a, b, 'desc'));
			return sorted.slice(0, count);
		}
	},
	{
		id: 'size_asc',
		label: 'Size (Smallest First)',
		description: 'Select items with the smallest positive size on disk first',
		select: (items, count) => {
			const sorted = [...items].sort((a, b) => compareSize(a, b, 'asc'));
			return sorted.slice(0, count);
		}
	},
	{
		id: 'most_popular',
		label: 'Most Popular',
		description: 'Select most popular items first',
		select: (items, count) => {
			const sorted = [...items].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
			return sorted.slice(0, count);
		}
	},
	{
		id: 'least_popular',
		label: 'Least Popular',
		description: 'Select least popular items first',
		select: (items, count) => {
			const sorted = [...items].sort((a, b) => (a.popularity || 0) - (b.popularity || 0));
			return sorted.slice(0, count);
		}
	},
	{
		id: 'alphabetical_asc',
		label: 'A-Z',
		description: 'Select items alphabetically by title (A to Z)',
		select: (items, count) => {
			const sorted = [...items].sort((a, b) =>
				sortTitle(a.title).localeCompare(sortTitle(b.title))
			);
			return sorted.slice(0, count);
		}
	},
	{
		id: 'alphabetical_desc',
		label: 'Z-A',
		description: 'Select items alphabetically by title (Z to A)',
		select: (items, count) => {
			const sorted = [...items].sort((a, b) =>
				sortTitle(b.title).localeCompare(sortTitle(a.title))
			);
			return sorted.slice(0, count);
		}
	}
];

/**
 * Get a selector by ID
 */
export function getSelector(id: string): Selector | undefined {
	return selectors.find((s) => s.id === id);
}

/**
 * Get all selector IDs
 */
export function getAllSelectorIds(): string[] {
	return selectors.map((s) => s.id);
}

/**
 * Validate if a selector ID exists
 */
export function isValidSelector(id: string): boolean {
	return selectors.some((s) => s.id === id);
}
