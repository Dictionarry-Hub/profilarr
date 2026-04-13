import type { ComponentType } from 'svelte';

/**
 * Column definition for table
 */
export type SortDirection = 'asc' | 'desc';

export interface SortState {
	key: string;
	direction: SortDirection;
}

export interface Column<T> {
	/** Unique key for the column */
	key: string;
	/** Header text to display */
	header: string;
	/** Optional icon component to display before header text */
	headerIcon?: ComponentType;
	/** Optional width class (e.g., 'w-32', 'w-1/4') */
	width?: string;
	/** Text alignment */
	align?: 'left' | 'center' | 'right';
	/** Whether column is sortable */
	sortable?: boolean;
	/** Optional accessor used for sorting (defaults to column key lookup) */
	sortAccessor?: (row: T) => string | number | boolean | Date | null | undefined;
	/** Optional comparator when sorter needs full row context */
	sortComparator?: (a: T, b: T) => number;
	/** Default sort direction when column is first sorted */
	defaultSortDirection?: SortDirection;
	/** Custom cell renderer - receives the full row object */
	cell?: (row: T) => string | ComponentType | { html: string };
	/** Hide column in mobile responsive layout */
	hideOnMobile?: boolean;
	/** Custom class(es) for the td element; can be a static string or a function of the row */
	tdClass?: string | ((row: T) => string);
}
