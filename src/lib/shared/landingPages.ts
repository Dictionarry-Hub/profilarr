/**
 * Pages that `/` can open, chosen in Settings > General.
 *
 * Saved choices store the id, not the path, so a route can move without
 * breaking them. Only top-level pages are listed: they handle missing
 * databases themselves, so a choice can't point at something deleted.
 */

export const LANDING_PAGES = [
	{ id: 'announcements', label: 'Announcements', path: '/announcements' },
	{ id: 'databases', label: 'Databases', path: '/databases' },
	{ id: 'arrs', label: 'Arrs', path: '/arr' },
	{ id: 'quality-profiles', label: 'Quality Profiles', path: '/quality-profiles' },
	{ id: 'custom-formats', label: 'Custom Formats', path: '/custom-formats' },
	{ id: 'regular-expressions', label: 'Regular Expressions', path: '/regular-expressions' },
	{ id: 'media-management', label: 'Media Management', path: '/media-management' },
	{ id: 'delay-profiles', label: 'Delay Profiles', path: '/delay-profiles' },
	{ id: 'settings', label: 'Settings', path: '/settings' }
] as const;

export type LandingPage = (typeof LANDING_PAGES)[number]['id'];

export function isLandingPage(value: unknown): value is LandingPage {
	return LANDING_PAGES.some((page) => page.id === value);
}

/**
 * Path for `/` to redirect to. A saved choice wins. Otherwise (no choice, or a
 * page that no longer exists) open Quality Profiles once a database is linked,
 * so fresh installs still start on Databases.
 */
export function resolveLandingPage(
	preference: string | null | undefined,
	hasDatabases: boolean
): string {
	const page = LANDING_PAGES.find((candidate) => candidate.id === preference);
	if (page) return page.path;
	return hasDatabases ? '/quality-profiles' : '/databases';
}
