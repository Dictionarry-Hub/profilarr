/**
 * Svelte action that lays out a grid so rows come out as full as possible.
 *
 * It measures the element, works out how many columns of at least `minWidth`
 * fit, then picks the column count whose last row is fullest, allowing up to
 * `slack` fewer columns than the maximum so the grid never collapses to a
 * sliver. Leftover width is shared between the columns. Re-runs on resize and
 * whenever `count` changes.
 *
 * Usage:
 * <div class="grid gap-2" use:balancedGrid={{ count: items.length, minWidth: 224, gap: 8 }}>
 */

export interface BalancedGridOptions {
	/** How many items the grid holds */
	count: number;
	/** Smallest width a column may have, in px */
	minWidth: number;
	/** Column gap, in px; must match the element's gap */
	gap: number;
	/** How many columns below the maximum the layout may drop to fill rows */
	slack?: number;
}

export function chooseColumns(width: number, options: BalancedGridOptions): number {
	const { count, minWidth, gap, slack = 2 } = options;
	if (count <= 0 || width <= 0) return 1;

	const maxColumns = Math.max(1, Math.floor((width + gap) / (minWidth + gap)));
	if (count <= maxColumns) return count;

	let best = maxColumns;
	let bestFill = 0;
	for (let columns = maxColumns; columns >= Math.max(1, maxColumns - slack); columns--) {
		const rows = Math.ceil(count / columns);
		const lastRow = count - (rows - 1) * columns;
		const fill = lastRow / columns;
		if (fill > bestFill) {
			best = columns;
			bestFill = fill;
		}
	}
	return best;
}

export function balancedGrid(node: HTMLElement, options: BalancedGridOptions) {
	let current = options;

	function apply() {
		const columns = chooseColumns(node.clientWidth, current);
		node.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
	}

	const observer = new ResizeObserver(apply);
	observer.observe(node);
	apply();

	return {
		update(next: BalancedGridOptions) {
			current = next;
			apply();
		},
		destroy() {
			observer.disconnect();
		}
	};
}
