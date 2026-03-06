/**
 * Public path definitions for auth
 * Extracted to avoid pulling in DB dependencies for consumers that only need path checks
 */

/**
 * Paths that don't require authentication (prefix match — path and all subpaths)
 */
const PUBLIC_PREFIX_PATHS = ['/auth/login', '/auth/setup', '/auth/oidc'];

/**
 * Paths that don't require authentication (exact match only)
 * /api/v1/health is public but /api/v1/health/diagnostics requires auth
 */
const PUBLIC_EXACT_PATHS = ['/api/v1/health'];

/**
 * Check if a path is public (doesn't require auth)
 */
export function isPublicPath(pathname: string): boolean {
	if (PUBLIC_EXACT_PATHS.includes(pathname)) return true;
	return PUBLIC_PREFIX_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
