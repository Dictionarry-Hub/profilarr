/**
 * Server-side database redirect utilities.
 *
 * Replaces the client-side onMount + localStorage + goto() pattern
 * with a server-side cookie + redirect(302) for instant navigation.
 */

import { redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';

const COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: false,
	maxAge: 60 * 60 * 24 * 365 // 1 year
};

/**
 * Reads the last-visited database ID from a cookie, validates it exists,
 * and throws redirect(302) to the appropriate route.
 *
 * Returns null if no databases exist (caller should render empty state).
 */
export function redirectToLastDatabase(
	cookies: Cookies,
	cookieName: string,
	routePrefix: string,
	options?: { suffix?: string }
): null {
	const databases = pcdManager.getAll();

	if (databases.length === 0) {
		return null;
	}

	const stored = cookies.get(cookieName);
	const storedId = stored ? parseInt(stored, 10) : NaN;
	const isValid = !isNaN(storedId) && databases.some((db) => db.id === storedId);
	const targetId = isValid ? storedId : databases[0].id;
	const suffix = options?.suffix ?? '';

	redirect(302, `${routePrefix}/${targetId}${suffix}`);
}

/**
 * Persists the selected database ID in a cookie.
 */
export function setLastDatabase(
	cookies: Cookies,
	cookieName: string,
	databaseId: number | string
): void {
	cookies.set(cookieName, String(databaseId), COOKIE_OPTIONS);
}

/**
 * Reads a section cookie and validates it against an allowed set.
 */
export function getLastSection(
	cookies: Cookies,
	cookieName: string,
	allowed: Set<string>,
	fallback: string
): string {
	const stored = cookies.get(cookieName);
	return stored && allowed.has(stored) ? stored : fallback;
}

/**
 * Persists a section selection in a cookie.
 */
export function setLastSection(cookies: Cookies, cookieName: string, section: string): void {
	cookies.set(cookieName, section, COOKIE_OPTIONS);
}
