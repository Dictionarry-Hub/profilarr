// `base` is deprecated in favour of `resolve()`, but this module needs the prefix as a
// value in order to strip it back off, which `resolve()` cannot express. Everywhere else
// in the app builds URLs with `resolve()`.
import { base } from '$app/paths';

/**
 * Normalise a path to a plain app path for route comparisons.
 *
 * Anything user facing is built with `resolve('/some/route')`, which prefixes the base
 * URL. That prefix is not a single value: in the browser it is the base URL
 * ('/profilarr', or '' when Profilarr is served from the root), while during SSR
 * SvelteKit substitutes a prefix relative to the page ('..', '../..') so the markup
 * works under any prefix. `page.url.pathname` differs the same way. It carries the
 * prefix in the browser, but the server sees the path with the base URL already
 * stripped by the adapter.
 *
 * Both forms normalise back to the same app path, which is what active state checks
 * and "is this an auth page" style comparisons want:
 *
 *   '/profilarr/settings/general' -> '/settings/general'   (browser, BASE_URL=/profilarr)
 *   '../settings/general'         -> '/settings/general'   (SSR)
 *   '/settings/general'           -> '/settings/general'   (browser, no base URL)
 */
export function routePath(path: string): string {
	if (!path.startsWith('/')) {
		// SSR relative href: strip the leading '.'/'..' segments `base` contributed.
		return path.replace(/^(?:\.\.?\/)*\.\.?/, '') || '/';
	}

	if (base.startsWith('/') && (path === base || path.startsWith(`${base}/`))) {
		return path.slice(base.length) || '/';
	}

	return path;
}

/**
 * Whether `href` is the current route, or an ancestor of it.
 *
 * Both sides go through {@link routePath}, so it doesn't matter whether the caller
 * built the href with `resolve()` or passed a plain app path.
 */
export function isRouteActive(
	href: string,
	pathname: string,
	options: { exact?: boolean } = {}
): boolean {
	const target = routePath(href);
	const current = routePath(pathname);

	if (options.exact) return current === target;
	return current === target || current.startsWith(`${target}/`);
}
