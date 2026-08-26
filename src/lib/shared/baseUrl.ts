/**
 * Base URL (reverse proxy subpath) helpers.
 *
 * Profilarr can be served from a subpath, for example
 * https://media.example.com/profilarr, the same way Radarr's and Sonarr's "URL Base"
 * setting works. The subpath comes from the BASE_URL env var and is used exactly as
 * given: '' means served from the root, and anything else is expected to look like
 * '/profilarr', with a leading slash and no trailing slash. A value in any other shape
 * is simply wrong and will behave that way.
 *
 * Shared between the adapter (src/adapter/files/mod.ts), which strips the prefix off
 * incoming requests, and the app config, which prefixes outgoing server side URLs.
 */

/**
 * Strip the base URL off a request pathname.
 *
 * Returns `null` when the path falls outside the base. Profilarr serves *only* from its
 * configured subpath, matching Radarr and Sonarr, so the caller answers those with a 404
 * rather than serving the app from two different places. Reverse proxies must therefore
 * pass the prefix through rather than stripping it.
 */
export function stripBaseUrl(pathname: string, baseUrl: string): string | null {
	if (!baseUrl) return pathname;
	if (pathname === baseUrl) return '/';
	if (pathname.startsWith(`${baseUrl}/`)) return pathname.slice(baseUrl.length);
	return null;
}

/**
 * Prefix an app absolute path with the base URL.
 *
 * External URLs (anything with a scheme, or protocol relative) and paths that already
 * carry the prefix are returned untouched.
 */
export function withBaseUrl(path: string, baseUrl: string): string {
	if (!baseUrl) return path;
	if (!path.startsWith('/') || path.startsWith('//')) return path;
	if (path === baseUrl || path.startsWith(`${baseUrl}/`)) return path;
	return `${baseUrl}${path}`;
}
