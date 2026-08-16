/**
 * Pick the release group to show for a series.
 *
 * `releaseGroups` arrives already ranked by how many seasons each group appears in,
 * so the first entry is the most common one. When a release group filter is active,
 * show a matching group instead so the row explains why it survived the filter.
 * Matching mirrors the smart filter: case-insensitive substring.
 */
export function primaryReleaseGroup(groups: string[], highlightGroups: string[] = []): string {
	if (groups.length === 0) return '';
	const matched = groups.find((group) =>
		highlightGroups.some((filter) => group.toLowerCase().includes(filter.toLowerCase()))
	);
	return matched ?? groups[0];
}
