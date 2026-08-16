/**
 * Normalize a title for natural alphabetical sorting.
 * Strips leading non-alphanumeric characters and common articles (the, a, an).
 *
 * @example
 * sortTitle("The Matrix")      // "matrix"
 * sortTitle("A Quiet Place")   // "quiet place"
 * sortTitle("An Example")      // "example"
 * sortTitle("  ...Hello")      // "hello"
 */
export function sortTitle(title: string | undefined): string {
	return (title || '')
		.toLowerCase()
		.replace(/^[^a-z0-9]+/, '')
		.replace(/^(the|a|an)\s+/, '');
}

export function dateSortValue(value: string | undefined): number | null {
	if (!value) return null;
	const timestamp = new Date(value).getTime();
	return Number.isNaN(timestamp) ? null : timestamp;
}

export function compareOptionalDates(
	a: string | undefined,
	b: string | undefined,
	direction: 'asc' | 'desc'
): number {
	const aValue = dateSortValue(a);
	const bValue = dateSortValue(b);

	if (aValue === null && bValue === null) return 0;
	if (aValue === null) return 1;
	if (bValue === null) return -1;

	return direction === 'asc' ? aValue - bValue : bValue - aValue;
}
